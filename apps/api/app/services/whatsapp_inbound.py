"""Channel-agnostic inbound WhatsApp pipeline.

Shared by the Baileys bridge endpoint and the Cloud API webhook: dedupe by
external message id, find or create the conversation, resolve media into text,
store the visitor message, and produce the AI reply unless a human operator has
taken over. The caller is responsible for actually delivering the reply.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..models import Agent, Conversation, Message, now_utc
from .knowledge import build_system_prompt, retrieve_knowledge
from .media import describe_image, transcribe_audio
from .providers import resolve_agent_credentials, resolve_provider_credentials
from .tools import run_completion
from .usage import record_usage


@dataclass
class InboundMessage:
    external_message_id: str
    external_chat_id: str
    sender_name: str | None = None
    text: str = ""
    media_kind: str | None = None
    media_bytes: bytes | None = None
    media_mime: str | None = None
    received_at: datetime | None = None


@dataclass
class InboundResult:
    accepted: bool
    reply: str | None = None
    conversation_id: uuid.UUID | None = None
    mode: str | None = None
    outbound_message_id: uuid.UUID | None = None
    sources: list = field(default_factory=list)
    tool_calls: list | None = None


def _media_placeholder(kind: str) -> str:
    return "[El cliente envió una imagen]" if kind == "image" else "[El cliente envió una nota de voz]"


async def _inbound_content(db: Session, agent: Agent, inbound: InboundMessage) -> str:
    """Resolve the effective user text, transcribing/describing media when the
    agent's capabilities allow it. Best-effort: falls back to a placeholder."""
    text = (inbound.text or "").strip()
    if not inbound.media_kind:
        return text
    if not inbound.media_bytes:
        return text or _media_placeholder(inbound.media_kind)
    enabled = (inbound.media_kind == "image" and agent.image_enabled) or (
        inbound.media_kind == "audio" and agent.audio_enabled
    )
    credentials = resolve_provider_credentials(db, agent.agency_id, "openai")
    if not enabled or not credentials:
        return text or _media_placeholder(inbound.media_kind)
    try:
        data = inbound.media_bytes
        base_url, api_key = credentials
        if inbound.media_kind == "image":
            model = agent.image_model.strip() or agent.model.strip()
            instruction = (
                "Describe con detalle el contenido de esta imagen para que un asistente pueda responder al cliente."
                + (f" El cliente escribió: {text}" if text else "")
            )
            description = await describe_image(base_url, api_key, model, data, inbound.media_mime or "image/jpeg", instruction)
            return (f"{text}\n\n" if text else "") + f"[Imagen recibida] {description}"
        model = agent.audio_model.strip() or "whisper-1"
        transcript = await transcribe_audio(base_url, api_key, model, data, "audio.ogg", inbound.media_mime or "audio/ogg")
        return (f"{text}\n\n" if text else "") + (transcript or _media_placeholder("audio"))
    except (HTTPException, ValueError):
        return text or _media_placeholder(inbound.media_kind)


async def process_inbound(
    db: Session,
    channel,
    inbound: InboundMessage,
    *,
    conversation_channel: str,
    channel_fk_field: str,
    persist_reply: bool = True,
    generate_reply: bool = True,
) -> InboundResult:
    """Run the shared pipeline for one inbound message.

    ``channel`` is a WhatsAppChannel or WhatsAppCloudChannel; both expose the
    same fields used here. ``conversation_channel`` and ``channel_fk_field``
    select the Conversation channel label and FK column for the caller.
    """
    fk_column = getattr(Conversation, channel_fk_field)

    existing = db.scalar(
        select(Message)
        .join(Conversation)
        .where(
            fk_column == channel.id,
            Message.external_message_id == inbound.external_message_id,
        )
    )
    if existing:
        return InboundResult(accepted=False, conversation_id=existing.conversation_id)

    conversation = db.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages))
        .where(
            fk_column == channel.id,
            Conversation.external_chat_id == inbound.external_chat_id,
        )
    )
    if not conversation:
        title = (inbound.sender_name or inbound.external_chat_id.split("@")[0])[:240]
        conversation = Conversation(
            agency_id=channel.agency_id,
            client_id=channel.client_id,
            agent_id=channel.agent_id,
            external_chat_id=inbound.external_chat_id,
            contact_name=inbound.sender_name,
            title=title,
            channel=conversation_channel,
            **{channel_fk_field: channel.id},
        )
        db.add(conversation)
        db.flush()
    elif inbound.sender_name:
        conversation.contact_name = inbound.sender_name

    content = await _inbound_content(db, channel.agent, inbound)
    visitor_message = Message(
        conversation_id=conversation.id,
        role="user",
        content=content,
        sender_type="visitor",
        sender_name=inbound.sender_name or "WhatsApp contact",
        external_message_id=inbound.external_message_id,
        external_received_at=inbound.received_at,
    )
    conversation.updated_at = now_utc()
    db.add(visitor_message)
    db.commit()
    if conversation.mode == "human" or not generate_reply:
        return InboundResult(accepted=True, conversation_id=conversation.id, mode="human")

    agent = channel.agent
    credentials = resolve_agent_credentials(db, agent)
    if not agent.is_active or not credentials or not agent.model.strip():
        channel.last_error = "A message was received, but the assigned agent is not ready (model or provider key missing)."
        channel.updated_at = now_utc()
        db.commit()
        return InboundResult(accepted=True, conversation_id=conversation.id, mode="ai")

    knowledge = await retrieve_knowledge(db, agent, content)
    db.refresh(conversation)
    history = db.scalars(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(agent.memory_limit)
    ).all()
    history = list(reversed(history))
    messages = [
        {"role": "system", "content": build_system_prompt(agent, knowledge.text)},
        *[{"role": item.role, "content": item.content} for item in history],
    ]
    base_url, api_key = credentials
    try:
        completion = await run_completion(
            db,
            agent,
            base_url,
            api_key,
            messages,
            temperature=agent.temperature,
            max_tokens=agent.max_tokens,
        )
    except Exception:
        channel.last_error = "Message received, but reply preparation failed. Check agent configuration."
        channel.updated_at = now_utc()
        db.commit()
        return InboundResult(accepted=True, conversation_id=conversation.id, mode="ai")

    # Refresh after the provider await: an operator may have taken over while
    # generation was in progress. Lock until the decision is persisted.
    db.refresh(conversation, with_for_update={"of": Conversation})
    if conversation.mode == "human":
        record_usage(db, agent.agency_id, agent.id, agent.provider, agent.model.strip(), completion)
        db.commit()
        return InboundResult(accepted=True, conversation_id=conversation.id, mode="human")
    outbound = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=completion.text,
        sources=knowledge.sources,
        tool_calls=completion.tool_calls,
        sender_type="ai",
        sender_name=agent.name,
    )
    record_usage(db, agent.agency_id, agent.id, agent.provider, agent.model.strip(), completion)
    conversation.updated_at = now_utc()
    channel.last_error = None
    if persist_reply:
        db.add(outbound)
    db.commit()
    return InboundResult(
        accepted=True,
        reply=completion.text,
        conversation_id=conversation.id,
        mode="ai",
        outbound_message_id=outbound.id if persist_reply else None,
        sources=knowledge.sources, tool_calls=completion.tool_calls,
    )
