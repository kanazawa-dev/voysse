import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models import Conversation, ConversationRuntime, ExecutionTurn, Message, User
from app.services import execution_state as state
from conftest import TestingSession
from test_execution_state import setup, call  # shared durable-turn fixture


@pytest.fixture
def review_case(setup, authenticated_client):
    agency, conv, message, agents = setup
    turn = uuid.uuid4()
    call(state.claim, agency, conv, turn, message, 0)
    with TestingSession() as db:
        client_id = db.get(Conversation, conv).client_id
    url = f'/api/studio/{client_id}/execution'
    payload = {'request_id': str(uuid.uuid4()), 'expected_revision': 0,
               'reason': 'Checked provider logs; handle manually', 'acknowledge_external_effects': True}
    return authenticated_client, url, f'{url}/{conv}/{turn}/review-human', payload, setup, turn


@pytest.mark.parametrize('uncertain', [False, True])
def test_review_preserves_context_and_blocks_late_completion(review_case, uncertain):
    c, url, action, payload, (agency, conv, message, agents), turn = review_case
    if uncertain: call(state.settle, agency, conv, turn, 0, uncertain=True)
    data = c.get(url).json()
    assert data['runtime_enabled'] is True and len(data['items']) == 1
    assert 'Context stays here' not in str(data)
    assert data['items'][0]['status'] == ('uncertain' if uncertain else 'running')
    response = c.post(action, json=payload)
    assert response.status_code == 200 and response.json()['applied']
    entry = response.json()['review']
    assert entry['actor_id'] and entry['reviewed_at'] and entry['revision'] == 1
    assert c.post(action, json=payload).json() == {'review': entry, 'applied': False}
    assert not call(state.settle, agency, conv, turn, 0)
    assert not call(state.claim, agency, conv, turn, message, 0)[1]
    with pytest.raises(HTTPException): call(state.claim, agency, conv, uuid.uuid4(), message, 1)
    with pytest.raises(HTTPException): call(state.transfer, agency, conv, turn, uuid.uuid4(), agents[1], 1, 'Late')
    with TestingSession() as db:
        runtime = db.get(ConversationRuntime, conv)
        assert runtime.responder_id is None and runtime.active_turn_id is None
        assert db.get(Conversation, conv).agent_id == agents[0]
        assert db.get(Conversation, conv).mode == 'human'
        assert db.get(ExecutionTurn, turn).status == 'reviewed_human'
        assert len(db.scalars(select(Message)).all()) == 1


@pytest.mark.parametrize('case', ['ack', 'reason', 'revision', 'extra', 'stale', 'wrong_client', 'wrong_turn', 'closed'])
def test_invalid_review_does_not_change_state(review_case, case):
    c, _, action, payload, (agency, conv, _, _), turn = review_case
    expected = 422
    if case == 'ack': payload['acknowledge_external_effects'] = False
    if case == 'reason': payload['reason'] = '  '
    if case == 'revision': payload['expected_revision'] = True
    if case == 'extra': payload['retry'] = True
    if case == 'stale': payload['expected_revision'] = 1; expected = 409
    if case == 'wrong_client': action = action.replace(action.split('/')[3], str(uuid.uuid4())); expected = 404
    if case == 'wrong_turn': action = action.replace(str(turn), str(uuid.uuid4())); expected = 404
    if case == 'closed': call(state.settle, agency, conv, turn, 0); expected = 409
    assert c.post(action, json=payload).status_code == expected
    with TestingSession() as db: assert not db.get(ExecutionTurn, turn).transitions


def test_review_key_conflict_and_concurrent_review(review_case):
    c, _, action, payload, _, turn = review_case
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: c.post(action, json=payload), range(2)))
    assert any(r.status_code == 200 and r.json()['applied'] for r in results)
    assert all(r.status_code in {200, 409} for r in results)
    assert not c.post(action, json=payload).json()['applied']
    assert c.post(action, json={**payload, 'reason': 'Different'}).status_code == 409
    assert c.post(action, json={**payload, 'request_id': str(uuid.uuid4())}).status_code == 409
    with TestingSession() as db: assert len(db.get(ExecutionTurn, turn).transitions) == 1


def test_scope_roles_and_pagination(review_case):
    c, url, action, payload, _, _ = review_case
    assert c.get(url + '?limit=0').status_code == 422
    assert c.get(url + '?limit=51').status_code == 422
    assert c.get(url + '?offset=1').json()['items'] == []
    other = c.post('/api/clients', json={'name': 'Other'}).json()['id']
    assert c.get(f'/api/studio/{other}/execution').json()['items'] == []
    c.post('/api/auth/register', json={'agency_name': 'Other', 'name': 'Other',
        'email': 'other@example.com', 'password': 'long-test-password'})
    assert c.get(url).status_code == 404
    assert c.post(action, json=payload).status_code == 404
    with TestingSession.begin() as db:
        for user in db.scalars(select(User)): user.role = 'operator'
    assert c.get(url).status_code == 403
    assert c.post(action, json=payload).status_code == 403
    c.post('/api/auth/logout')
    assert c.get(url).status_code == 401
    assert c.post(action, json=payload).status_code == 401


def test_listing_pages_and_review_lock_conflict(review_case):
    c, url, action, payload, (agency, conv, _, agents), _ = review_case
    other_conv = uuid.UUID(c.post('/api/conversations', json={'agent_id': str(agents[0])}).json()['id'])
    with TestingSession.begin() as db:
        message = Message(conversation_id=other_conv, role='user', content='Another context')
        db.add(message); db.flush()
        message_id = message.id
    call(state.claim, agency, other_conv, uuid.uuid4(), message_id, 0)
    first = c.get(url + '?limit=1').json()
    second = c.get(url + '?limit=1&offset=1').json()
    assert first['has_more'] and not second['has_more']
    assert first['items'][0]['turn_id'] != second['items'][0]['turn_id']
    with TestingSession.begin() as db:
        db.scalar(select(Conversation).where(Conversation.id == conv).with_for_update())
        assert c.post(action, json=payload).status_code == 409
    assert c.post(action, json=payload).json()['applied']
