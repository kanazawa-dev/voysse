"""Internal transaction protocol. No live transport invokes it until adapted.

Callers own commit/rollback. Commit a NEW claim before external work; never replay
provider/tools for an existing claim. No lease expiry or uncertain-work retry.
"""
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from ..models import Agency, Agent, Client, Conversation, ConversationRuntime, ExecutionTurn, Message


def locked(db, agency_id, conversation_id):
    try:
        conversation = db.scalar(select(Conversation).where(Conversation.id == conversation_id,
            Conversation.agency_id == agency_id).execution_options(populate_existing=True).with_for_update(nowait=True))
    except OperationalError as exc:
        if getattr(exc.orig, "sqlstate", None) == "55P03":
            raise HTTPException(409, "Conversation lock busy") from exc
        raise
    if not conversation:
        raise HTTPException(404, "Conversation not found")
    if not db.get(Agency, agency_id, populate_existing=True).is_active or not db.get(Client, conversation.client_id, populate_existing=True).is_active:
        raise HTTPException(409, "Conversation unavailable")
    runtime = db.get(ConversationRuntime, conversation_id, populate_existing=True)
    return conversation, runtime


def agent_for(db, conversation, agent_id):
    try:
        agent = db.scalar(select(Agent).where(Agent.id == agent_id).execution_options(populate_existing=True).with_for_update(nowait=True)) if agent_id else None
    except OperationalError as exc:
        if getattr(exc.orig, "sqlstate", None) == "55P03":
            raise HTTPException(409, "Responder lock busy") from exc
        raise
    if not agent or not agent.is_active or agent.client_id != conversation.client_id or agent.agency_id != conversation.agency_id:
        raise HTTPException(409, "Responder unavailable")
    return agent


def claim(db, agency_id, conversation_id, turn_id, message_id, expected_revision, max_hops=3):
    conversation, runtime = locked(db, agency_id, conversation_id)
    previous = db.get(ExecutionTurn, turn_id, populate_existing=True)
    if previous:
        if (previous.conversation_id, previous.context_message_id, previous.request_revision, previous.max_hops) != (conversation_id, message_id, expected_revision, max_hops):
            raise HTTPException(409, "Turn key reused with different input")
        return previous, False
    if type(max_hops) is not int or not 1 <= max_hops <= 5 or type(expected_revision) is not int or expected_revision < 0:
        raise HTTPException(422, "Invalid execution bounds")
    if db.scalar(select(ExecutionTurn.id).where(ExecutionTurn.conversation_id == conversation_id, ExecutionTurn.context_message_id == message_id)):
        raise HTTPException(409, "Context message already claimed")
    message = db.get(Message, message_id)
    if not message or message.conversation_id != conversation_id or message.role != "user":
        raise HTTPException(409, "Context message unavailable")
    if runtime is None:
        runtime = ConversationRuntime(conversation_id=conversation_id, responder_id=conversation.agent_id, revision=0)
        db.add(runtime)
    if conversation.mode != "ai" or runtime.active_turn_id is not None or runtime.revision != expected_revision:
        raise HTTPException(409, "Conversation is busy, human-controlled or changed")
    agent = agent_for(db, conversation, runtime.responder_id)
    turn = ExecutionTurn(id=turn_id, conversation_id=conversation_id, context_message_id=message_id,
        request_revision=expected_revision, max_hops=max_hops, source_agent_id=runtime.responder_id, responder_version=agent.updated_at, status="running", transitions=[])
    runtime.active_turn_id = turn_id
    db.add(turn)
    db.flush()
    return turn, True


def owned_turn(db, runtime, turn_id):
    turn = db.get(ExecutionTurn, turn_id, populate_existing=True)
    if not runtime or not turn or turn.conversation_id != runtime.conversation_id:
        raise HTTPException(404, "Execution turn not found")
    return turn


def transfer(db, agency_id, conversation_id, turn_id, transition_id, target_id, expected_revision, reason):
    conversation, runtime = locked(db, agency_id, conversation_id)
    turn = owned_turn(db, runtime, turn_id)
    if not isinstance(reason, str) or not 1 <= len(reason.strip()) <= 500:
        raise HTTPException(422, "Transition reason required")
    identity = {"id": str(transition_id), "target_id": str(target_id) if target_id else None, "reason": reason.strip(), "expected_revision": expected_revision}
    for entry in turn.transitions:
        if entry["id"] == identity["id"]:
            if any(entry[key] != value for key, value in identity.items()):
                raise HTTPException(409, "Transition key reused with different input")
            return entry, False
    if runtime.active_turn_id != turn_id or turn.status != "running" or conversation.mode != "ai" or runtime.revision != expected_revision:
        raise HTTPException(409, "Execution owner changed")
    target = None
    if target_id:
        if agent_for(db, conversation, runtime.responder_id).updated_at != turn.responder_version:
            raise HTTPException(409, "Responder configuration changed")
        target = agent_for(db, conversation, target_id)
        visited = {str(turn.source_agent_id), *[entry["target_id"] for entry in turn.transitions]}
        if str(target_id) in visited or len(turn.transitions) >= turn.max_hops:
            raise HTTPException(409, "Cycle or hop limit; request human attention")
    entry = {**identity, "source_id": str(runtime.responder_id) if runtime.responder_id else None, "revision": runtime.revision + 1}
    turn.responder_version = target.updated_at if target else None
    turn.transitions = [*turn.transitions, entry]
    runtime.responder_id, runtime.revision = target_id, runtime.revision + 1
    if target_id is None:
        conversation.mode, turn.status, runtime.active_turn_id = "human", "human", None
    db.flush()
    return entry, True


def settle(db, agency_id, conversation_id, turn_id, expected_revision, *, uncertain=False):
    conversation, runtime = locked(db, agency_id, conversation_id)
    turn = owned_turn(db, runtime, turn_id)
    if turn.status != "running":
        return False
    if runtime.active_turn_id != turn_id or runtime.revision != expected_revision:
        raise HTTPException(409, "Execution owner changed")
    if not uncertain and conversation.mode == "ai" and agent_for(db, conversation, runtime.responder_id).updated_at != turn.responder_version:
        raise HTTPException(409, "Responder configuration changed")
    turn.status = "uncertain" if uncertain else ("human" if conversation.mode == "human" else "completed")
    if not uncertain:
        runtime.active_turn_id = None
        runtime.revision += 1
        if conversation.mode == "human":
            runtime.responder_id = None
    db.flush()
    return turn.status == "completed"
