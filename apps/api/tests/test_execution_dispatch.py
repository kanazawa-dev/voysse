import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import select

from app.models import Agent, Client, Conversation, ConversationRuntime, ExecutionTurn, Message
from app.services import execution_dispatch
from app.services.ai import Completion
from conftest import TestingSession


@pytest.fixture
def routed(authenticated_client, monkeypatch):
    c = authenticated_client
    client_id = c.post('/api/clients', json={'name': 'Dispatch'}).json()['id']
    c.put('/api/providers/openai', json={'api_key': 'secret'})
    agents = [uuid.UUID(c.post('/api/agents', json={
        'client_id': client_id, 'name': n, 'provider': 'openai', 'model': 'gpt-4.1-mini',
    }).json()['id']) for n in ['Entry', 'Support']]
    conversation_id = uuid.UUID(c.post('/api/conversations', json={'agent_id': str(agents[0])}).json()['id'])
    with TestingSession.begin() as db:
        message = Message(conversation_id=conversation_id, role='user', content='Need technical help')
        db.add(message); db.flush()
        message_id = message.id
        agency_id = db.get(Conversation, conversation_id).agency_id
    mock = AsyncMock(return_value=Completion(text='{"rule_index":0,"reason":"Technical"}'))
    monkeypatch.setattr(execution_dispatch, 'chat_completion', mock)
    # The respond phase now calls run_completion() (for knowledge/tools), not
    # chat_completion() directly; same mock covers both call signatures here
    # since neither test cares about the exact reply text, only who sent it.
    monkeypatch.setattr(execution_dispatch, 'run_completion', mock)
    return c, agency_id, conversation_id, message_id, agents, client_id


def publish(client, client_id, rules, max_hops=3):
    saved = client.put(f'/api/studio/{client_id}/handoffs', json={'expected_revision': 0, 'rules': rules, 'max_hops': max_hops})
    assert saved.status_code == 200, saved.text
    published = client.post(f'/api/studio/{client_id}/policies', json={
        'request_id': str(uuid.uuid4()), 'action': 'publish', 'expected_revision': 0,
        'draft_revision': saved.json()['revision'], 'reason': 'Ready'})
    assert published.status_code == 200, published.text
    return published.json()['version']['id']


def rule(source, target):
    return {'source_agent_id': str(source), 'target_agent_id': str(target) if target else None, 'condition': 'Needs specialist help'}


def dispatch_call(conversation_id, message_id, entry_id, agency_id):
    with TestingSession() as db:
        conversation = db.get(Conversation, conversation_id)
        entry_agent = db.get(Agent, entry_id)
        import asyncio
        return asyncio.run(execution_dispatch.dispatch(agency_id=agency_id, conversation=conversation,
            message_id=message_id, entry_agent=entry_agent))


def test_dispatch_without_published_policy_returns_none(routed):
    _, agency, conv, message, agents, _ = routed
    assert dispatch_call(conv, message, agents[0], agency) is None
    with TestingSession() as db:
        assert db.scalar(select(ExecutionTurn)) is None


def test_dispatch_with_unrelated_policy_returns_none(routed):
    c, agency, conv, message, agents, client_id = routed
    publish(c, client_id, [rule(agents[1], agents[0])])  # a rule exists, but not for the entry agent
    assert dispatch_call(conv, message, agents[0], agency) is None
    with TestingSession() as db:
        assert db.scalar(select(ExecutionTurn)) is None


def test_dispatch_matching_policy_invokes_runner(routed):
    c, agency, conv, message, agents, client_id = routed
    publish(c, client_id, [rule(agents[0], agents[1])])
    status, message_id = dispatch_call(conv, message, agents[0], agency)
    assert status == 'completed' and message_id
    with TestingSession() as db:
        turn = db.scalar(select(ExecutionTurn))
        assert turn.status == 'completed' and len(turn.transitions) == 1
        assert db.get(ConversationRuntime, conv).responder_id == agents[1]
        stored = db.get(Message, message_id)
        assert stored.role == 'assistant' and stored.sender_name == 'Support'


def test_dispatch_swallows_runner_failures(routed):
    c, agency, conv, message, agents, client_id = routed
    publish(c, client_id, [rule(agents[0], agents[1])])
    with TestingSession.begin() as db:
        db.get(Agent, agents[1]).is_active = False  # target no longer usable once the classifier picks it
    status, message_id = dispatch_call(conv, message, agents[0], agency)
    assert status == 'human' and message_id is None
    with TestingSession() as db:
        assert not list(db.scalars(select(Message).where(Message.role == 'assistant')))
