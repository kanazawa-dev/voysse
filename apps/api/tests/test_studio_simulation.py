import uuid
from unittest.mock import AsyncMock
import pytest
from sqlalchemy import func, select
from app.models import Agent, Client, Conversation, UsageRecord, User
from app.routers import studio_simulation as sim
from app.services.ai import Completion
from conftest import TestingSession


@pytest.fixture
def setup(authenticated_client, monkeypatch):
    c = authenticated_client
    client_id = c.post('/api/clients', json={'name': 'Simulation'}).json()['id']
    agents = [c.post('/api/agents', json={'client_id': client_id, 'name': name, 'model': 'test'}).json()['id'] for name in ['Sales', 'Support']]
    url = f'/api/studio/{client_id}/handoffs'
    rules = [{'source_agent_id': agents[0], 'target_agent_id': agents[1], 'condition': 'Technical question'},
             {'source_agent_id': agents[1], 'target_agent_id': None, 'condition': 'Needs human'}]
    assert c.put(url, json={'expected_revision': 0, 'rules': rules}).status_code == 200
    mock = AsyncMock(return_value=Completion('{"rule_index":0,"reason":"Technical question"}', 10, 5))
    monkeypatch.setattr(sim, 'chat_completion', mock)
    monkeypatch.setattr(sim, 'resolve_agent_credentials', lambda *_: ('https://invalid.example', 'fake'))
    return c, url, agents, mock, {'source_agent_id': agents[0], 'expected_revision': 1, 'message': 'Help with an error'}


def test_match_has_no_conversation_or_draft_effects(setup):
    c, url, a, mock, body = setup
    before = c.get(url).json()
    response = c.post(url + '/simulate', json=body)
    assert response.status_code == 200
    assert response.json()['target_agent_id'] == a[1] and response.json()['simulation_only']
    assert response.json()['condition'] == 'Technical question'
    assert c.get(url).json() == before
    assert mock.await_count == 1 and mock.call_args.kwargs['max_tokens'] == 256
    assert len(mock.call_args.args[4]) == 2  # No real history, agent tools or retrieval.
    with TestingSession() as db:
        assert db.scalar(select(func.count()).select_from(Conversation)) == 0
        assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


@pytest.mark.parametrize('answer,outcome', [('not json', 'invalid_response'), ('{"rule_index":true,"reason":"bad"}', 'invalid_response'), ('{"rule_index":1,"reason":"wrong source"}', 'invalid_response'), ('{"rule_index":null,"reason":"Uncertain"}', 'human_fallback')])
def test_invalid_or_uncertain_model_result_is_human(setup, answer, outcome):
    c, url, _, mock, body = setup
    mock.return_value = Completion(answer, 1, 1)
    data = c.post(url + '/simulate', json=body).json()
    assert data['outcome'] == outcome and data['target_agent_id'] is None


def test_explicit_human_and_empty_rules(setup):
    c, url, a, mock, body = setup
    mock.return_value = Completion('{"rule_index":1,"reason":"Needs human"}')
    assert c.post(url + '/simulate', json={**body, 'source_agent_id': a[1]}).json()['outcome'] == 'matched'
    c.put(url, json={'expected_revision': 1, 'rules': []})
    mock.reset_mock()
    assert c.post(url + '/simulate', json={**body, 'expected_revision': 2}).json()['outcome'] == 'no_rules'
    mock.assert_not_called()


@pytest.mark.parametrize('change', ['draft', 'agent', 'role'])
def test_revalidate_after_provider_and_keep_usage(setup, change):
    c, url, a, mock, body = setup
    async def changed(*args, **kwargs):
        with TestingSession() as db:
            if change == 'draft':
                client = db.scalar(select(Client)); client.handoff_draft = {**client.handoff_draft, 'revision': 2}
            elif change == 'agent': db.get(Agent, uuid.UUID(a[1])).is_active = False
            else: db.scalar(select(User)).role = 'operator'
            db.commit()
        return Completion('{"rule_index":0,"reason":"match"}', 3, 2)
    mock.side_effect = changed
    assert c.post(url + '/simulate', json=body).status_code == (403 if change == 'role' else 409)
    with TestingSession() as db: assert db.scalar(select(func.count()).select_from(UsageRecord)) == 1


def test_input_scope_and_credentials_fail_before_call(setup, monkeypatch):
    c, url, _, mock, body = setup
    for overrides, status in [({'message': ' '}, 422), ({'message': 'a' * 4001}, 422), ({'expected_revision': 0}, 409), ({'source_agent_id': str(uuid.uuid4())}, 404)]:
        assert c.post(url + '/simulate', json={**body, **overrides}).status_code == status
    monkeypatch.setattr(sim, 'resolve_agent_credentials', lambda *_: None)
    assert c.post(url + '/simulate', json=body).status_code == 409
    assert c.post('/api/auth/register', json={'agency_name': 'Other', 'name': 'Other', 'email': 'other@example.com', 'password': 'long-test-password'}).status_code == 201
    assert c.post(url + '/simulate', json=body).status_code == 404
    mock.assert_not_called()
