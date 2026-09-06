import uuid
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from app.models import Agent, Client, Conversation, ExecutionTurn, Message, PolicyRevision
from app.services import execution_state as state
from conftest import TestingSession
from test_execution_state import setup, call


@pytest.fixture
def policy_case(setup, authenticated_client):
    agency, conv, _, agents = setup
    with TestingSession() as db: client = str(db.get(Conversation, conv).client_id)
    c = authenticated_client
    c.put(f'/api/studio/{client}/handoffs', json={'expected_revision': 0, 'max_hops': 1,
        'rules': [{'source_agent_id': str(agents[0]), 'target_agent_id': str(agents[1]), 'condition': 'Support'}]})
    url = f'/api/studio/{client}/policies'
    payload = {'request_id': str(uuid.uuid4()), 'expected_revision': 0, 'action': 'publish', 'draft_revision': 1, 'reason': 'Ready'}
    assert c.post(url, json=payload).status_code == 200
    return c, url, uuid.UUID(payload['request_id']), setup


def test_turn_keeps_pin_across_unpublish_and_replay(policy_case):
    c, url, policy, (agency, conv, message, agents) = policy_case
    turn = uuid.uuid4()
    claimed, created = call(state.claim_published, agency, conv, turn, message, 0)
    assert created and claimed.policy_revision_id == policy and claimed.max_hops == 1
    c.post(url, json={'request_id': str(uuid.uuid4()), 'expected_revision': 1, 'action': 'unpublish', 'reason': 'Pause new turns'})
    assert not call(state.claim_published, agency, conv, turn, message, 0)[1]
    with pytest.raises(HTTPException): call(state.claim, agency, conv, turn, message, 0, max_hops=1)
    call(state.transfer, agency, conv, turn, uuid.uuid4(), agents[1], 0, 'Support')
    assert call(state.settle, agency, conv, turn, 1)
    with TestingSession.begin() as db:
        msg = Message(conversation_id=conv, role='user', content='Next'); db.add(msg); db.flush(); next_id = msg.id
    with pytest.raises(HTTPException): call(state.claim_published, agency, conv, uuid.uuid4(), next_id, 2)
    assert not call(state.claim_published, agency, conv, turn, message, 0)[1]
    listing = c.get(url.replace('/policies', '/execution')).json()['items']
    assert listing[0]['policy_revision_id'] == str(policy)


@pytest.mark.parametrize('case', ['outside_edge', 'missing', 'foreign', 'inactive', 'hops'])
def test_pinned_transfers_fail_closed_but_human_exit_remains(policy_case, case):
    c, _, policy, (agency, conv, message, a) = policy_case
    turn = uuid.uuid4(); call(state.claim_published, agency, conv, turn, message, 0)
    if case in {'missing', 'foreign', 'inactive'}:
        other = c.post('/api/clients', json={'name': 'Other'}).json()['id']
        with TestingSession.begin() as db:
            if case == 'missing': db.delete(db.get(PolicyRevision, policy))
            if case == 'foreign': db.get(PolicyRevision, policy).client_id = uuid.UUID(other)
            if case == 'inactive': db.get(Agent, a[1]).is_active = False
    target, revision = a[2] if case == 'outside_edge' else a[1], 0
    if case == 'hops':
        call(state.transfer, agency, conv, turn, uuid.uuid4(), a[1], 0, 'First'); target, revision = a[2], 1
    with pytest.raises(HTTPException): call(state.transfer, agency, conv, turn, uuid.uuid4(), target, revision, 'Invalid')
    if case in {'missing', 'foreign', 'inactive'}:
        with pytest.raises(HTTPException): call(state.settle, agency, conv, turn, revision)
    call(state.transfer, agency, conv, turn, uuid.uuid4(), None, revision, 'Human review')
    with TestingSession() as db: assert db.get(ExecutionTurn, turn).status == 'human'


def test_new_claim_uses_restored_head_and_client_lock(policy_case):
    c, url, policy, (agency, conv, message, _) = policy_case
    with TestingSession.begin() as db:
        client_id = db.get(Conversation, conv).client_id
        db.scalar(select(Client).where(Client.id == client_id).with_for_update())
        with pytest.raises(HTTPException): call(state.claim_published, agency, conv, uuid.uuid4(), message, 0)
    restored = c.post(url, json={'request_id': str(uuid.uuid4()), 'expected_revision': 1, 'action': 'restore', 'restore_revision': 1, 'reason': 'New head'}).json()['version']
    with pytest.raises(HTTPException): call(state.claim, agency, conv, uuid.uuid4(), message, 0, 1, policy_id=policy)
    with pytest.raises(HTTPException): call(state.claim, agency, conv, uuid.uuid4(), message, 0, 3, policy_id=uuid.UUID(restored['id']))
    turn, created = call(state.claim_published, agency, conv, uuid.uuid4(), message, 0)
    assert created and str(turn.policy_revision_id) == restored['id']
    with pytest.raises(HTTPException): call(state.claim_published, agency, conv, turn.id, uuid.uuid4(), 0)


def test_no_publication_and_legacy_turn_cannot_be_upgraded(setup):
    agency, conv, message, _ = setup
    with pytest.raises(HTTPException): call(state.claim_published, agency, conv, uuid.uuid4(), message, 0)
    turn = uuid.uuid4(); call(state.claim, agency, conv, turn, message, 0)
    with pytest.raises(HTTPException): call(state.claim_published, agency, conv, turn, message, 0)
