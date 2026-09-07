import asyncio
import uuid
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from app.models import Agent, Conversation, ConversationRuntime, ExecutionTurn, Message, UsageRecord
from app.services import execution_runner as runner
from app.services.ai import Completion
from conftest import TestingSession
from test_execution_state import setup
from test_turn_policy import policy_case


@pytest.fixture
def ready(policy_case):
    *_, case = policy_case
    with TestingSession.begin() as db:
        for agent in case[3]: db.get(Agent, agent).model = 'test-model'
    return case


def execute(case, provider, turn=None):
    agency, conv, message, _ = case
    return asyncio.run(runner.run(TestingSession, agency, conv, turn or uuid.uuid4(), message, 0, provider))


def test_chain_context_atomic_response_and_replay(ready):
    agency, conv, message, agents = ready
    seen, turn = [], uuid.uuid4()
    async def provider(work, phase):
        seen.append((work, phase))
        with TestingSession.begin() as db:
            db.scalar(select(Conversation).where(Conversation.id == conv).with_for_update(nowait=True))
        return Completion('{"rule_index":0,"reason":"Support"}' if phase == 'classify' else 'Resolved', 10, 3)
    status, response = execute(ready, provider, turn)
    assert status == 'completed' and response
    assert [w.agent_id for w, _ in seen] == agents[:2]
    assert seen[0][0].messages == seen[1][0].messages == (('user', 'Context stays here'),)
    assert execute(ready, provider, turn) == ('completed', None) and len(seen) == 2
    with TestingSession() as db:
        assert db.get(Conversation, conv).agent_id == agents[0]
        assert db.get(Message, response).content == 'Resolved'
        assert db.get(ConversationRuntime, conv).responder_id == agents[1]
        assert len(list(db.scalars(select(UsageRecord)))) == 2


@pytest.mark.parametrize('output', ['garbage', '{"rule_index":31,"reason":"Outside"}', '{"rule_index":null,"reason":"Unclear"}'])
def test_uncertain_choice_exits_human(ready, output):
    async def provider(*_): return Completion(output)
    assert execute(ready, provider) == ('human', None)
    with TestingSession() as db:
        assert db.get(Conversation, ready[1]).mode == 'human'
        assert not list(db.scalars(select(Message).where(Message.role == 'assistant')))


@pytest.mark.parametrize('phase', ['classify', 'respond'])
@pytest.mark.parametrize('change', ['human', 'agent', 'context', 'inactive'])
def test_late_results_rejected_usage_kept(ready, change, phase):
    agency, conv, message, agents = ready
    turn = uuid.uuid4()
    async def provider(work, current_phase):
        if current_phase != phase: return Completion('{"rule_index":0,"reason":"Support"}')
        with TestingSession.begin() as db:
            if change == 'human': db.get(Conversation, conv).mode = 'human'
            elif change == 'agent': db.get(Agent, work.agent_id).instructions = 'Changed'
            elif change == 'context': db.get(Message, message).content = 'Changed'
            else: db.get(Agent, work.agent_id).is_active = False
        return Completion('{"rule_index":0,"reason":"Support"}', 10, 2)
    with pytest.raises(HTTPException): execute(ready, provider, turn)
    with TestingSession() as db:
        assert not list(db.scalars(select(Message).where(Message.role == 'assistant')))
        assert db.get(ExecutionTurn, turn).status == 'uncertain'
        assert len(list(db.scalars(select(UsageRecord)))) == 1
    assert execute(ready, provider, turn) == ('uncertain', None)


@pytest.mark.parametrize('error', [RuntimeError, asyncio.CancelledError])
def test_failure_and_cancellation_not_retried(ready, error):
    turn, calls = uuid.uuid4(), []
    async def provider(*_): calls.append(1); raise error('provider stopped')
    with pytest.raises(error): execute(ready, provider, turn)
    assert execute(ready, provider, turn) == ('uncertain', None) and len(calls) == 1


def test_duplicate_during_io_never_calls_provider_twice(ready):
    agency, conv, message, _ = ready
    turn, calls = uuid.uuid4(), []
    async def provider(*_):
        calls.append(1)
        assert await runner.run(TestingSession, agency, conv, turn, message, 0, provider) == ('running', None)
        return Completion('{"rule_index":null,"reason":"Human"}')
    assert execute(ready, provider, turn) == ('human', None) and len(calls) == 1


def test_invalid_final_response_rolls_back(ready):
    async def provider(_, phase): return Completion('{"rule_index":0,"reason":"Support"}' if phase == 'classify' else '')
    with pytest.raises(HTTPException): execute(ready, provider)
    with TestingSession() as db:
        assert not list(db.scalars(select(Message).where(Message.role == 'assistant')))
        turn = db.scalar(select(ExecutionTurn))
        assert turn.status == 'uncertain' and len(turn.transitions) == 1


def test_oversize_context_prevents_claim_and_io(ready):
    with TestingSession.begin() as db: db.get(Message, ready[2]).content = 'x' * 64001
    async def provider(*_): pytest.fail('No I/O for oversized context')
    with pytest.raises(HTTPException): execute(ready, provider)
    with TestingSession() as db: assert not list(db.scalars(select(ExecutionTurn)))


def test_settlement_failure_rolls_back_response(ready, monkeypatch):
    original = runner.state.settle
    def fail(db, *args, **kwargs):
        if not kwargs.get('uncertain'): raise RuntimeError('commit boundary failed')
        return original(db, *args, **kwargs)
    monkeypatch.setattr(runner.state, 'settle', fail)
    async def provider(_, phase): return Completion('{"rule_index":0,"reason":"Support"}' if phase == 'classify' else 'Result')
    with pytest.raises(RuntimeError): execute(ready, provider)
    with TestingSession() as db:
        assert not list(db.scalars(select(Message).where(Message.role == 'assistant')))
        assert db.scalar(select(ExecutionTurn)).status == 'uncertain'


def test_pinned_chain_survives_unpublish_during_io(ready, policy_case):
    c, url, _, _ = policy_case
    async def provider(_, phase):
        if phase == 'classify':
            assert c.post(url, json={'request_id': str(uuid.uuid4()), 'expected_revision': 1, 'action': 'unpublish', 'reason': 'Pause'}).status_code == 200
        return Completion('{"rule_index":0,"reason":"Support"}' if phase == 'classify' else 'Result')
    assert execute(ready, provider)[0] == 'completed'


def test_hop_limit_exits_without_extra_provider_call(ready, policy_case):
    c, url, _, (_, conv, _, agents) = policy_case
    with TestingSession() as db: client = db.get(Conversation, conv).client_id
    rules = [{'source_agent_id': str(agents[i]), 'target_agent_id': str(agents[i+1]), 'condition': 'Next'} for i in range(2)]
    assert c.put(f'/api/studio/{client}/handoffs', json={'expected_revision': 1, 'max_hops': 1, 'rules': rules}).status_code == 200
    assert c.post(url, json={'request_id': str(uuid.uuid4()), 'expected_revision': 1, 'action': 'publish', 'draft_revision': 2, 'reason': 'Chain'}).status_code == 200
    seen = []
    async def provider(*_): seen.append(1); return Completion('{"rule_index":0,"reason":"First"}')
    assert execute(ready, provider) == ('human', None) and len(seen) == 1


def test_failed_target_preparation_rolls_back_transition_and_marks_uncertain(ready):
    async def provider(*_):
        with TestingSession.begin() as db: db.get(Agent, ready[3][1]).model = ''
        return Completion('{"rule_index":0,"reason":"Support"}')
    with pytest.raises(HTTPException): execute(ready, provider)
    with TestingSession() as db:
        turn = db.scalar(select(ExecutionTurn))
        assert turn.status == 'uncertain' and turn.transitions == []
        assert db.get(ConversationRuntime, ready[1]).responder_id == ready[3][0]
