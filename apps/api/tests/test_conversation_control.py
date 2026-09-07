import uuid

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.models import Conversation, ConversationRuntime, ExecutionTurn
from app.services import execution_state as state
from app.services.conversation_control import set_mode
from conftest import TestingSession
from test_execution_state import setup, call
from test_turn_policy import policy_case


@pytest.mark.parametrize('status', ['running', 'uncertain', 'completed'])
def test_mode_route_preserves_runtime_and_blocks_resume(setup, authenticated_client, status):
    agency, conv, message, agents = setup
    turn = uuid.uuid4()
    call(state.claim, agency, conv, turn, message, 0)
    if status != 'running':
        call(state.settle, agency, conv, turn, 0, uncertain=status == 'uncertain')
    url = f'/api/conversations/{conv}/mode'
    with TestingSession() as db:
        owner = db.get(ConversationRuntime, conv)
        before = (owner.revision, owner.responder_id, owner.active_turn_id)
    assert authenticated_client.patch(url, json={'mode': 'human'}).status_code == 200
    assert authenticated_client.patch(url, json={'mode': 'ai'}).status_code == 409
    with TestingSession() as db:
        owner = db.get(ConversationRuntime, conv)
        assert (owner.revision, owner.responder_id, owner.active_turn_id) == before
        assert db.get(Conversation, conv).mode == 'human'
        assert db.get(Conversation, conv).agent_id == agents[0]
        assert db.get(ExecutionTurn, turn).status == status
    assert not call(state.settle, agency, conv, turn, before[0])


def test_legacy_conversations_still_toggle(setup, authenticated_client):
    url = f'/api/conversations/{setup[1]}/mode'
    for mode in ['human', 'ai']:
        response = authenticated_client.patch(url, json={'mode': mode})
        assert response.status_code == 200 and response.json()['mode'] == mode


def test_mode_control_contends_with_claim_lock(setup):
    with TestingSession.begin() as holding:
        holding.scalar(select(Conversation).where(Conversation.id == setup[1]).with_for_update())
        with TestingSession.begin() as other:
            with pytest.raises(HTTPException) as error:
                set_mode(other, other.get(Conversation, setup[1]), 'human')
            assert error.value.status_code == 409


def test_human_control_prevents_new_claim(setup, authenticated_client):
    agency, conv, message, _ = setup
    assert authenticated_client.patch(f'/api/conversations/{conv}/mode', json={'mode': 'human'}).status_code == 200
    with pytest.raises(HTTPException):
        call(state.claim, agency, conv, uuid.uuid4(), message, 0)


def test_portal_cannot_bypass_runtime_resume(setup, authenticated_client):
    from app.main import app
    from app.models import Client
    from app.routers.portal import _portal_client
    agency, conv, message, _ = setup
    call(state.claim, agency, conv, uuid.uuid4(), message, 0)
    with TestingSession() as db:
        customer = db.get(Client, db.get(Conversation, conv).client_id)
        app.dependency_overrides[_portal_client] = lambda: customer
    try:
        url = f'/api/portal/test/conversations/{conv}/mode'
        assert authenticated_client.patch(url, json={'mode': 'human'}).status_code == 200
        assert authenticated_client.patch(url, json={'mode': 'ai'}).status_code == 409
        assert authenticated_client.patch(url.replace(str(conv), str(uuid.uuid4())), json={'mode': 'human'}).status_code == 404
    finally:
        app.dependency_overrides.pop(_portal_client, None)


def test_actual_runner_result_is_fenced_after_takeover(policy_case, authenticated_client):
    import asyncio
    from app.models import Agent, Message, UsageRecord
    from app.services.execution_runner import run
    from app.services.ai import Completion
    _, _, _, (agency, conv, message, agents) = policy_case
    with TestingSession.begin() as db:
        for agent in agents:
            db.get(Agent, agent).model = 'test-model'
    turn = uuid.uuid4()
    async def provider(*_):
        url = f'/api/conversations/{conv}/mode'
        assert authenticated_client.patch(url, json={'mode': 'human'}).status_code == 200
        assert authenticated_client.patch(url, json={'mode': 'ai'}).status_code == 409
        return Completion('{"rule_index":0,"reason":"Support"}', 10, 2)
    with pytest.raises(HTTPException):
        asyncio.run(run(TestingSession, agency, conv, turn, message, 0, provider))
    with TestingSession() as db:
        assert db.get(ExecutionTurn, turn).status == 'uncertain'
        assert db.get(ConversationRuntime, conv).active_turn_id == turn
        assert not list(db.scalars(select(Message).where(Message.role == 'assistant')))
        assert len(list(db.scalars(select(UsageRecord)))) == 1
