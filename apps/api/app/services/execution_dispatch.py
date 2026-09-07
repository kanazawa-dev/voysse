"""Wires execution_runner.run() into a live reply. Only engages when the entry
agent has a live rule in the client's currently published policy; otherwise the
caller keeps its existing direct-reply path untouched (no published policy today
means literally zero behavior change on any wired surface).
"""
import uuid

from sqlalchemy import select

from ..database import SessionLocal
from ..models import Agent, ConversationRuntime, PolicyRevision
from ..routers.studio_handoffs import Draft
from ..routers.studio_simulation import classify_messages
from . import execution_runner
from .ai import chat_completion
from .providers import resolve_provider_credentials

_TURN_NAMESPACE = uuid.UUID("2f6a5d9e-6f0a-4a1e-9d3a-6a2c8b7e5d4f")


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
        temperature = agent.temperature if agent else None
        max_tokens = agent.max_tokens if agent else None
    if not credentials:
        raise ValueError("Responder credentials unavailable")
    base_url, api_key = credentials
    if phase == "classify":
        conditions = {i: condition for i, _target, condition in work.rules}
        message_text = work.messages[-1][1] if work.messages else ""
        messages = classify_messages(conditions, message_text, "es")
        return await chat_completion(work.provider, base_url, api_key, work.model, messages, temperature=0, max_tokens=256)
    messages = [{"role": "system", "content": work.system}, *[{"role": role, "content": content} for role, content in work.messages]]
    return await chat_completion(work.provider, base_url, api_key, work.model, messages,
        temperature=temperature, max_tokens=max_tokens)


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
