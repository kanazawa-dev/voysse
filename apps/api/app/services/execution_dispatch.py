"""Wires execution_runner into a live reply. Only engages when the entry
agent has a live rule in the client's currently published policy; otherwise the
caller keeps its existing direct-reply path untouched (no published policy today
means literally zero behavior change on any wired surface).

dispatch() is for callers where "generated" and "shown" are the same moment
(dashboard chat, the widget). dispatch_prepare()/dispatch_finalize()/dispatch_abort()
are for callers that must confirm external delivery before the reply is visible
(WhatsApp, Instagram/Messenger): generate with dispatch_prepare(), attempt delivery,
then dispatch_finalize() on success or dispatch_abort() on failure.
"""
import uuid
from dataclasses import dataclass, replace

from sqlalchemy import select

from ..database import SessionLocal
from ..models import Agent, ConversationRuntime, PolicyRevision
from ..routers.studio_handoffs import Draft
from ..routers.studio_simulation import classify_messages
from . import execution_runner
from .ai import chat_completion
from .knowledge import build_system_prompt, retrieve_knowledge
from .providers import resolve_provider_credentials
from .tools import run_completion

_TURN_NAMESPACE = uuid.UUID("2f6a5d9e-6f0a-4a1e-9d3a-6a2c8b7e5d4f")


@dataclass(frozen=True)
class Dispatched:
    """None from dispatch_prepare() means no published policy routes this agent:
    the caller's existing direct-reply path is untouched, zero side effects.

    A Dispatched with prepared=None means the policy DID route this agent but the
    turn ended without a reply (human handoff, hop limit, or a genuine failure the
    runner already marked uncertain) -- the caller must not generate or send a
    reply itself either; treat it exactly like human-controlled mode.

    A Dispatched with prepared set means a reply was generated but not stored:
    call dispatch_finalize() once external delivery is confirmed, or
    dispatch_abort() if delivery fails.
    """
    prepared: execution_runner.Prepared | None
    agency_id: uuid.UUID
    conversation_id: uuid.UUID


def _published_policy(db, client_id):
    row = db.scalar(select(PolicyRevision).where(PolicyRevision.client_id == client_id,
        PolicyRevision.policy.is_not(None)).order_by(PolicyRevision.revision.desc()).limit(1))
    return Draft.model_validate(row.policy) if row else None


def _routes(policy, agent_id) -> bool:
    return policy is not None and any(rule.source_agent_id == agent_id for rule in policy.rules)


async def _provider(agency_id, work, phase):
    with SessionLocal() as db:
        credentials = resolve_provider_credentials(db, agency_id, work.provider)
        agent = db.get(Agent, work.agent_id)
        if not credentials or not agent:
            raise ValueError("Responder credentials unavailable")
        base_url, api_key = credentials
        if phase == "classify":
            conditions = {i: condition for i, _target, condition in work.rules}
            message_text = work.messages[-1][1] if work.messages else ""
            messages = classify_messages(conditions, message_text, "es")
            return await chat_completion(work.provider, base_url, api_key, work.model, messages, temperature=0, max_tokens=256)
        # Only the terminal "respond" phase sees real knowledge and may run tools;
        # classification stays tool-free and knowledge-free, unchanged above.
        query = work.messages[-1][1] if work.messages else ""
        knowledge = await retrieve_knowledge(db, agent, query)
        system = build_system_prompt(agent, knowledge.text, at=work.anchor_at)
        messages = [{"role": "system", "content": system}, *[{"role": role, "content": content} for role, content in work.messages]]
        completion = await run_completion(db, agent, base_url, api_key, messages,
            temperature=agent.temperature, max_tokens=agent.max_tokens)
        return replace(completion, sources=knowledge.sources)


async def dispatch_prepare(*, agency_id, conversation, message_id, entry_agent) -> Dispatched | None:
    """See Dispatched for the three possible outcomes."""
    with SessionLocal() as db:
        policy = _published_policy(db, conversation.client_id)
        if not _routes(policy, entry_agent.id):
            return None
        runtime = db.get(ConversationRuntime, conversation.id)
        revision = runtime.revision if runtime else 0

    turn_id = uuid.uuid5(_TURN_NAMESPACE, str(message_id))

    async def provider(work, phase):
        return await _provider(agency_id, work, phase)

    try:
        status, prepared = await execution_runner.prepare(SessionLocal, agency_id, conversation.id, turn_id, message_id, revision, provider)
    except Exception:
        status, prepared = "human", None
    return Dispatched(prepared if status == "ready" else None, agency_id, conversation.id)


async def dispatch_finalize(dispatched: Dispatched, *, external_message_id=None):
    """Store the prepared reply and settle its turn. Returns the assistant message id.
    Only valid when dispatched.prepared is set."""
    return await execution_runner.finalize(SessionLocal, dispatched.agency_id, dispatched.conversation_id,
        dispatched.prepared, external_message_id=external_message_id)


async def dispatch_abort(dispatched: Dispatched):
    """External delivery failed: release the turn as uncertain. Never raises.
    Only valid when dispatched.prepared is set."""
    await execution_runner.abort(SessionLocal, dispatched.agency_id, dispatched.conversation_id, dispatched.prepared)


def serialize(dispatched: Dispatched) -> dict | None:
    """JSON-safe snapshot of a Dispatched with a pending reply, for a caller whose
    gap between generation and confirmed delivery can span a worker restart (a
    durable retry may resume in a different process than the one that prepared
    it). Store this instead of holding the Dispatched object in memory; pass it
    back through deserialize() before calling dispatch_finalize()/dispatch_abort().
    None in, None out."""
    if dispatched is None or dispatched.prepared is None:
        return None
    p = dispatched.prepared
    return {"turn_id": str(p.turn_id), "revision": p.revision, "agent_id": str(p.agent_id),
            "agent_name": p.agent_name, "content": p.content, "tool_calls": p.tool_calls, "sources": list(p.sources),
            "agency_id": str(dispatched.agency_id), "conversation_id": str(dispatched.conversation_id)}


def deserialize(data: dict | None) -> Dispatched | None:
    if data is None:
        return None
    prepared = execution_runner.Prepared(uuid.UUID(data["turn_id"]), data["revision"], uuid.UUID(data["agent_id"]),
        data["agent_name"], data["content"], data.get("tool_calls"), tuple(data.get("sources") or ()))
    return Dispatched(prepared, uuid.UUID(data["agency_id"]), uuid.UUID(data["conversation_id"]))


async def dispatch(*, agency_id, conversation, message_id, entry_agent):
    """None => no published policy routes this agent; caller's existing direct
    path is unchanged. Otherwise (status, message_id) from execution_runner.run(),
    where status in {"completed", "human", "uncertain", "running"}."""
    with SessionLocal() as db:
        policy = _published_policy(db, conversation.client_id)
        if not _routes(policy, entry_agent.id):
            return None
        runtime = db.get(ConversationRuntime, conversation.id)
        revision = runtime.revision if runtime else 0

    turn_id = uuid.uuid5(_TURN_NAMESPACE, str(message_id))

    async def provider(work, phase):
        return await _provider(agency_id, work, phase)

    try:
        return await execution_runner.run(SessionLocal, agency_id, conversation.id, turn_id, message_id, revision, provider)
    except Exception:
        return "human", None
