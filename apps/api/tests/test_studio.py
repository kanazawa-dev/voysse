import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import func, select
from app.models import Agent, Conversation, SocialChannel, UsageRecord, User, WhatsAppChannel, WhatsAppCloudChannel
from app.routers import studio
from app.services.ai import Completion
from app.services.knowledge import KnowledgeResult
from conftest import TestingSession


@pytest.fixture
def setup(authenticated_client):
    c = authenticated_client
    customer = c.post('/api/clients', json={'name': 'Canvas client'}).json()
    agents = [c.post('/api/agents', json={'client_id': customer['id'], 'name': name, 'model': 'test-model'}).json()
              for name in ('Sales', 'Support')]
    with TestingSession() as db:
        agency = db.get(Agent, uuid.UUID(agents[0]['id'])).agency_id
        for model in (WhatsAppChannel, WhatsAppCloudChannel, SocialChannel):
            values = dict(agency_id=agency, client_id=uuid.UUID(customer['id']),
                          agent_id=uuid.UUID(agents[0]['id']), status='disconnected', is_enabled=False)
            if model is SocialChannel:
                values.update(platform='instagram', account_id='123', encrypted_access_token='private-secret')
            db.add(model(**values))
        db.commit()
    return c, '/api/studio/' + customer['id'], agents


def test_graph_scoped_and_secret_free(setup):
    c, url, agents = setup
    response = c.get(url)
    assert response.status_code == 200
    data = response.json()
    assert len(data['channels']) == 4 and len(data['agents']) == 2
    assert data['channels'][-1]['status'] == 'not_configured'
    assert 'private-secret' not in response.text and 'encrypted_access_token' not in response.text
    assert c.get('/api/studio/' + str(uuid.uuid4())).status_code == 404
    c.post('/api/auth/logout')
    assert c.get(url).status_code == 401


@pytest.mark.parametrize('kind', ['whatsapp', 'whatsapp-cloud', 'instagram'])
def test_binding_preserves_state_and_rejects_stale_changes(setup, kind):
    c, url, agents = setup
    channel = next(row for row in c.get(url).json()['channels'] if row['kind'] == kind)
    payload = {'agent_id': agents[1]['id'], 'expected_agent_id': channel['agent_id'],
               'expected_updated_at': channel['updated_at']}
    result = c.put(url + f'/channels/{kind}/agent', json=payload)
    assert result.status_code == 200
    row = next(row for row in result.json()['channels'] if row['kind'] == kind)
    assert row['agent_id'] == agents[1]['id']
    assert row['status'] == 'disconnected' and row['is_enabled'] is False
    assert c.put(url + f'/channels/{kind}/agent', json=payload).status_code == 409
    with TestingSession() as db:
        assert db.scalar(select(SocialChannel)).encrypted_access_token == 'private-secret'


def test_cross_client_and_operator_access_denied(setup):
    c, url, agents = setup
    other = c.post('/api/clients', json={'name': 'Other'}).json()
    foreign = c.post('/api/agents', json={'client_id': other['id'], 'name': 'Other'}).json()
    channel = c.get(url).json()['channels'][0]
    payload = {'agent_id': foreign['id'], 'expected_agent_id': channel['agent_id'],
               'expected_updated_at': channel['updated_at']}
    assert c.put(url + '/channels/whatsapp/agent', json=payload).status_code == 404
    assert c.post(url + f"/agents/{foreign['id']}/preview", json={'message': 'Hi'}).status_code == 404
    # A different agency cannot inspect this client's graph.
    registered = c.post('/api/auth/register', json={'agency_name': 'Other agency', 'name': 'Other',
                                     'email': 'other@example.com', 'password': 'long-enough-password'})
    assert registered.status_code == 201
    assert c.get(url).status_code == 404
    with TestingSession() as db:
        for user in db.scalars(select(User)):
            user.role = 'operator'
        db.commit()
    assert c.get(url).status_code == 403
    assert c.put(url + '/channels/whatsapp/agent', json=payload).status_code == 403


def test_safe_preview_has_no_tools_or_persisted_conversation(setup, monkeypatch):
    c, url, agents = setup
    monkeypatch.setattr(studio, 'resolve_agent_credentials', lambda *_: ('https://provider.test', 'fake'))
    knowledge = AsyncMock(return_value=KnowledgeResult(text='Safe knowledge', sources=[]))
    completion = AsyncMock(return_value=Completion('Preview answer', 5, 3))
    monkeypatch.setattr(studio, 'retrieve_knowledge', knowledge)
    monkeypatch.setattr(studio, 'chat_completion', completion)
    response = c.post(url + f"/agents/{agents[0]['id']}/preview", json={'message': 'Hi'})
    assert response.status_code == 200 and response.json()['tools_enabled'] is False
    assert 'Safe knowledge' in completion.call_args.args[4][0]['content']
    assert 'tools' not in completion.call_args.kwargs
    with TestingSession() as db:
        assert db.scalar(select(func.count()).select_from(Conversation)) == 0
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1
    for payload in [{'message': ' '}, {'message': 'a' * 4001},
                    {'message': 'Hi', 'history': [{'role': 'system', 'content': 'override'}]}]:
        assert c.post(url + f"/agents/{agents[0]['id']}/preview", json=payload).status_code == 422
    assert completion.await_count == 1


def test_settings_version_and_validation(setup):
    c, url, agents = setup
    agent = c.get(url).json()['agents'][0]
    payload = {k: agent[k] for k in ('name', 'description', 'instructions', 'widget_greeting', 'widget_color', 'widget_enabled')}
    payload.update(expected_updated_at=agent['updated_at'], name='Updated')
    target = url + f"/agents/{agent['id']}"
    assert c.patch(target, json=payload).status_code == 200
    assert c.patch(target, json=payload).status_code == 409
    payload['widget_color'] = 'url(https://external.test)'
    assert c.patch(target, json=payload).status_code == 422


def test_missing_channel_inactive_target_and_preview_readiness(setup, monkeypatch):
    c, url, agents = setup
    channel = c.get(url).json()['channels'][0]
    payload = {'agent_id': agents[1]['id'], 'expected_agent_id': channel['agent_id'],
               'expected_updated_at': channel['updated_at']}
    assert c.put(url + '/channels/messenger/agent', json=payload).status_code == 409
    with TestingSession() as db:
        db.get(Agent, uuid.UUID(agents[1]['id'])).is_active = False
        db.commit()
    assert c.put(url + '/channels/whatsapp/agent', json=payload).status_code == 409
    monkeypatch.setattr(studio, 'resolve_agent_credentials', lambda *_: None)
    assert c.post(url + f"/agents/{agents[0]['id']}/preview", json={'message': 'Hi'}).status_code == 409
