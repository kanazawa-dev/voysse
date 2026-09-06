import uuid
from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from app.models import Agent, Conversation, ConversationRuntime, ExecutionTurn, Message
from app.services import execution_state as state
from conftest import TestingSession


@pytest.fixture
def setup(authenticated_client):
    c = authenticated_client
    client = c.post('/api/clients', json={'name': 'Runtime'}).json()['id']
    agents = [uuid.UUID(c.post('/api/agents', json={'client_id': client, 'name': n}).json()['id']) for n in ['Entry', 'Support', 'Third']]
    conversation = uuid.UUID(c.post('/api/conversations', json={'agent_id': str(agents[0])}).json()['id'])
    with TestingSession.begin() as db:
        message = Message(conversation_id=conversation, role='user', content='Context stays here')
        db.add(message); db.flush()
        return db.get(Conversation, conversation).agency_id, conversation, message.id, agents


def call(fn, *args, **kwargs):
    with TestingSession.begin() as db: return fn(db, *args, **kwargs)


def test_transfer_keeps_entry_and_context_with_idempotent_journal(setup):
    agency, conv, message, a = setup
    turn, step = uuid.uuid4(), uuid.uuid4()
    assert call(state.claim, agency, conv, turn, message, 0)[1]
    assert not call(state.claim, agency, conv, turn, message, 0)[1]
    assert call(state.transfer, agency, conv, turn, step, a[1], 0, 'Technical')[1]
    assert not call(state.transfer, agency, conv, turn, step, a[1], 0, 'Technical')[1]
    with TestingSession() as db:
        assert db.get(Conversation, conv).agent_id == a[0]
        assert db.get(ConversationRuntime, conv).responder_id == a[1]
        assert db.get(Message, message).content == 'Context stays here'
        assert len(db.get(ExecutionTurn, turn).transitions) == 1
    assert call(state.settle, agency, conv, turn, 1)
    assert not call(state.claim, agency, conv, turn, message, 0)[1]
    assert not call(state.settle, agency, conv, turn, 1)
    with pytest.raises(HTTPException): call(state.claim, agency, conv, uuid.uuid4(), message, 2)


def test_concurrent_claims_only_one_producer(setup):
    agency, conv, message, _ = setup
    turn = uuid.uuid4()
    def attempt(_):
        try: return call(state.claim, agency, conv, turn, message, 0)[1]
        except HTTPException as exc:
            assert exc.status_code == 409
            return 'busy'
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(attempt, range(2)))
    assert sum(result is True for result in results) == 1
    with pytest.raises(HTTPException): call(state.claim, agency, conv, uuid.uuid4(), message, 0)


@pytest.mark.parametrize('case', ['cycle', 'hops', 'stale', 'key', 'foreign', 'inactive'])
def test_invalid_transfers_do_not_replace_owner(setup, case):
    agency, conv, message, a = setup
    turn, step = uuid.uuid4(), uuid.uuid4()
    call(state.claim, agency, conv, turn, message, 0, max_hops=1)
    call(state.transfer, agency, conv, turn, step, a[1], 0, 'First')
    if case == 'inactive':
        with TestingSession.begin() as db: db.get(Agent, a[2]).is_active = False
    target = a[0] if case == 'cycle' else uuid.uuid4() if case == 'foreign' else a[2]
    with pytest.raises(HTTPException):
        call(state.transfer, agency, conv, turn, step if case == 'key' else uuid.uuid4(), target, 0 if case == 'stale' else 1, 'Next')
    with TestingSession() as db: assert db.get(ConversationRuntime, conv).responder_id == a[1]
    call(state.transfer, agency, conv, turn, uuid.uuid4(), None, 1, 'Human fallback')
    with TestingSession() as db:
        assert db.get(Conversation, conv).mode == 'human'
        assert db.get(ExecutionTurn, turn).status == 'human'


def test_uncertain_claim_never_expires_or_restarts(setup):
    agency, conv, message, _ = setup
    turn = uuid.uuid4(); call(state.claim, agency, conv, turn, message, 0)
    assert not call(state.settle, agency, conv, turn, 0, uncertain=True)
    assert not call(state.claim, agency, conv, turn, message, 0)[1]
    with TestingSession() as db: assert db.get(ConversationRuntime, conv).active_turn_id == turn
    with pytest.raises(HTTPException): call(state.transfer, agency, conv, turn, uuid.uuid4(), None, 0, 'Retry')


def test_human_takeover_and_changed_agent_block_publication(setup):
    agency, conv, message, a = setup
    turn = uuid.uuid4(); call(state.claim, agency, conv, turn, message, 0)
    with TestingSession.begin() as db: db.get(Agent, a[0]).name = 'Changed'
    with pytest.raises(HTTPException): call(state.settle, agency, conv, turn, 0)
    with TestingSession.begin() as db: db.get(Conversation, conv).mode = 'human'
    assert not call(state.settle, agency, conv, turn, 0)
    with TestingSession() as db: assert db.get(ExecutionTurn, turn).status == 'human'


def test_scope_context_and_bounds(setup):
    agency, conv, message, _ = setup
    for args in [(uuid.uuid4(), conv, uuid.uuid4(), message, 0), (agency, conv, uuid.uuid4(), uuid.uuid4(), 0), (agency, conv, uuid.uuid4(), message, 4)]:
        with pytest.raises(HTTPException): call(state.claim, *args)
    with pytest.raises(HTTPException): call(state.claim, agency, conv, uuid.uuid4(), message, 0, max_hops=6)
    with TestingSession() as db: assert db.scalar(select(ConversationRuntime)) is None


def test_next_message_uses_current_responder_and_missing_responder_fails_closed(setup):
    agency, conv, message, a = setup
    turn = uuid.uuid4(); call(state.claim, agency, conv, turn, message, 0)
    call(state.transfer, agency, conv, turn, uuid.uuid4(), a[1], 0, 'Transfer')
    call(state.settle, agency, conv, turn, 1)
    with TestingSession.begin() as db:
        next_message = Message(conversation_id=conv, role='user', content='Follow-up')
        db.add(next_message); db.flush(); next_id = next_message.id
    next_turn, created = call(state.claim, agency, conv, uuid.uuid4(), next_id, 2)
    assert created and next_turn.source_agent_id == a[1]
    with TestingSession.begin() as db: db.get(Agent, a[1]).is_active = False
    with pytest.raises(HTTPException): call(state.settle, agency, conv, next_turn.id, 2)
    assert call(state.transfer, agency, conv, next_turn.id, uuid.uuid4(), None, 2, 'Unavailable responder')[1]


def test_busy_responder_is_rejected_without_waiting(setup):
    agency, conv, message, a = setup
    with TestingSession.begin() as blocker:
        blocker.scalar(select(Agent).where(Agent.id == a[0]).with_for_update())
        with pytest.raises(HTTPException) as error:
            call(state.claim, agency, conv, uuid.uuid4(), message, 0)
        assert error.value.status_code == 409 and 'lock busy' in error.value.detail
