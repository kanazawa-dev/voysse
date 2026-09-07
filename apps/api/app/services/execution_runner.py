"""Dormant, tool-free policy runner. No current endpoint/worker calls this module.

The injected provider adapter MUST NOT execute tools or send channel messages.
Only a newly committed claim may run. Lost work stays blocked; there is no resume.
"""
import uuid
from dataclasses import dataclass
from datetime import datetime
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select, tuple_
from ..models import Agent, Conversation, Message, now_utc
from ..routers.studio_simulation import Choice
from . import execution_state as state
from .knowledge import build_system_prompt
from .usage import record_usage


@dataclass(frozen=True)
class Input:
    agent_id: uuid.UUID
    version: datetime
    provider: str
    model: str
    system: str
    messages: tuple[tuple[str, str], ...]
    # Global policy index, target UUID (None = human), condition.
    rules: tuple[tuple[int, uuid.UUID | None, str], ...]


def snapshot(db, agency, conversation_id, turn_id, revision):
    conversation, runtime = state.locked(db, agency, conversation_id)
    turn = state.owned_turn(db, runtime, turn_id)
    if conversation.mode != 'ai' or turn.status != 'running' or runtime.active_turn_id != turn_id or runtime.revision != revision:
        raise HTTPException(409, 'Execution owner changed')
    agent = state.agent_for(db, conversation, runtime.responder_id)
    if agent.updated_at != turn.responder_version or not agent.model.strip():
        raise HTTPException(409, 'Responder configuration unavailable')
    policy = state.pinned_policy(db, conversation, turn.policy_revision_id)
    anchor = db.get(Message, turn.context_message_id, populate_existing=True)
    if not anchor or anchor.conversation_id != conversation_id or anchor.role != 'user':
        raise HTTPException(409, 'Context unavailable')
    rows = list(db.scalars(select(Message).where(Message.conversation_id == conversation_id,
        Message.role.in_(['user', 'assistant']), tuple_(Message.created_at, Message.id) <= tuple_(anchor.created_at, anchor.id))
        .order_by(Message.created_at.desc(), Message.id.desc()).limit(min(100, max(1, agent.memory_limit)))))
    messages = tuple((m.role, m.content) for m in reversed(rows))
    if sum(len(content) for _, content in messages) > 64000:
        raise HTTPException(409, 'Context exceeds execution budget')
    rules = tuple((i, r.target_agent_id, r.condition) for i, r in enumerate(policy.rules) if r.source_agent_id == agent.id)
    system = build_system_prompt(agent, '', at=anchor.created_at)
    if len(system) > 64000:
        raise HTTPException(409, 'Instructions exceed execution budget')
    return Input(agent.id, agent.updated_at, agent.provider, agent.model.strip(), system, messages, rules)


def checked(db, agency, conversation, turn, revision, expected):
    current = snapshot(db, agency, conversation, turn, revision)
    if current != expected:
        raise HTTPException(409, 'Execution inputs changed')
    return current


async def run(session_factory, agency, conversation, turn, message, revision, provider):
    """provider(Input, phase) -> Completion; phase is classify or respond.

    classify must return Choice JSON using only Input.rules indices. No rules =
    terminal responder. Null/invalid classification = human, never guessed routing.
    Returns (status, assistant_message_id | None); completed means stored, NOT sent.
    Caller must authenticate/authorize before invocation; no public API is exposed.
    """
    with session_factory.begin() as db:
        claimed, created = state.claim_published(db, agency, conversation, turn, message, revision)
        if not created:
            return claimed.status, None
        work = snapshot(db, agency, conversation, turn, revision)
        max_hops = claimed.max_hops
    try:
        for hop in range(max_hops + 1):
            with session_factory.begin() as db:
                checked(db, agency, conversation, turn, revision, work)
                if hop == max_hops and work.rules:
                    state.transfer(db, agency, conversation, turn, uuid.uuid4(), None, revision, 'Hop limit reached')
                    return 'human', None
            # No open DB session or row lock during external I/O.
            completion = await provider(work, 'classify' if work.rules else 'respond')
            with session_factory.begin() as db:
                agent = db.get(Agent, work.agent_id)
                record_usage(db, agency, agent.id if agent else None, work.provider, work.model, completion)
            with session_factory.begin() as db:
                checked(db, agency, conversation, turn, revision, work)
                if completion.tool_calls:
                    raise HTTPException(409, 'Tools are not supported by this runner')
                if not work.rules:
                    if not isinstance(completion.text, str) or not 1 <= len(completion.text.strip()) <= 32000:
                        raise HTTPException(409, 'Invalid response')
                    response = Message(conversation_id=conversation, role='assistant', content=completion.text,
                                       sender_type='ai', sender_name=db.get(Agent, work.agent_id).name)
                    db.add(response)
                    if not state.settle(db, agency, conversation, turn, revision):
                        raise HTTPException(409, 'Response no longer owned')
                    db.get(Conversation, conversation).updated_at = now_utc()
                    db.flush()
                    return 'completed', response.id
                target, reason = None, 'Invalid or uncertain classification'
                try:
                    choice = Choice.model_validate_json(completion.text)
                    matches = [r for r in work.rules if r[0] == choice.rule_index]
                    if choice.rule_index is None or matches:
                        target, reason = (matches[0][1] if matches else None), choice.reason
                except (ValidationError, ValueError):
                    pass
                state.transfer(db, agency, conversation, turn, uuid.uuid4(), target, revision, reason)
                if target is None:
                    return 'human', None
                work = snapshot(db, agency, conversation, turn, revision + 1)
            revision += 1  # Advance only after the transition transaction commits.
    except BaseException:
        # Cancellation too. Failure to record uncertainty must never replace the
        # original exception or release ownership; running claims remain blocked.
        try:
            with session_factory.begin() as db:
                state.settle(db, agency, conversation, turn, revision, uncertain=True)
        except Exception:
            pass
        raise
