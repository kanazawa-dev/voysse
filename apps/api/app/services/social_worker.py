"""PostgreSQL worker: retries generation, never blindly retries an external send.

The channel row serializes its jobs across workers, keeping conversation ordering.
Only retrieval/text generation is enabled in this first version: replaying tool
side effects after a crash requires a separate idempotency contract.
"""
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import exists, select, text
from sqlalchemy.orm import Session

from ..models import Agency, Conversation, Message, SocialChannel, SocialEvent, now_utc
from .ai import chat_completion
from .execution_dispatch import deserialize, dispatch_abort, dispatch_finalize, dispatch_prepare, serialize
from .knowledge import build_system_prompt, retrieve_knowledge
from .providers import resolve_agent_credentials
from .social import ensure_send_allowed, send_text
from .usage import record_usage


async def _release_route(event):
    """Release a claimed-but-unfinalized route before a ready event is given up
    on (never sent). Not called when the reply stays valid for a later retry."""
    routed = deserialize(event.route_state)
    if routed is not None:
        await dispatch_abort(routed)


async def work_once(db: Session) -> bool:
    # A crash after send started has an unknown outcome, not a retryable job.
    timed_out = db.scalars(select(SocialEvent).where(SocialEvent.status == "sending",
        SocialEvent.updated_at < now_utc() - timedelta(minutes=2))).all()
    for stuck in timed_out:
        await _release_route(stuck)
        stuck.status, stuck.last_error = "uncertain", "Worker stopped during delivery. Verify the external conversation before replying."
    db.commit()
    pending = exists(select(SocialEvent.id).where(SocialEvent.channel_id == SocialChannel.id,
        SocialEvent.status.in_(("queued", "ready"))))
    sending = exists(select(SocialEvent.id).where(SocialEvent.channel_id == SocialChannel.id, SocialEvent.status == "sending"))
    # Advisory locks serialize workers without blocking webhook admission or a
    # user's disconnect while an LLM is slow. The lock is released on commit.
    channel = None
    candidates = db.scalars(select(SocialChannel).where(pending, ~sending)
        .order_by(SocialChannel.updated_at).limit(32)).all()
    for candidate in candidates:
        locked = db.scalar(text("SELECT pg_try_advisory_xact_lock(hashtextextended(:key, 0))"),
            {"key": str(candidate.id)})
        if locked:
            channel = candidate
            break
    if not channel:
        db.rollback()
        return False
    event = db.scalar(select(SocialEvent).where(SocialEvent.channel_id == channel.id,
        SocialEvent.status.in_(("queued", "ready"))).order_by(SocialEvent.received_at, SocialEvent.id)
        .with_for_update().limit(1))
    if not event:
        db.rollback()
        return False
    event.attempts += 1
    event.updated_at = now_utc()
    agency = db.get(Agency, channel.agency_id)
    if not channel.is_enabled or not channel.client.is_active or not agency or not agency.is_active:
        event.status, event.last_error = "ignored", "Channel or client inactive"
        db.commit()
        return True
    conversation = db.scalar(select(Conversation).where(Conversation.social_channel_id == channel.id,
        Conversation.external_chat_id == event.sender_id))
    if not conversation:
        conversation = Conversation(agency_id=channel.agency_id, client_id=channel.client_id,
            agent_id=channel.agent_id, social_channel_id=channel.id, channel=channel.platform,
            external_chat_id=event.sender_id, title=event.text[:80])
        db.add(conversation)
        db.flush()
    event.conversation_id = conversation.id
    message_id = db.scalar(select(Message.id).where(Message.conversation_id == conversation.id,
        Message.external_message_id == event.external_id))
    if not message_id:
        visitor_message = Message(conversation_id=conversation.id, role="user", content=event.text,
            sender_type="visitor", external_message_id=event.external_id, created_at=event.received_at)
        db.add(visitor_message)
        db.flush()
        message_id = visitor_message.id
    conversation.updated_at = now_utc()
    if not event.supported:
        conversation.mode = "human"
    if conversation.mode == "human":
        event.status = "ignored"
        db.commit()
        return True
    # Durable before dispatch_prepare(), which looks up the conversation and
    # context message through its own separate connection.
    db.commit()
    routed = None
    try:
        ensure_send_allowed(db, channel, conversation)
        agent = channel.agent
        credentials = resolve_agent_credentials(db, agent)
        if not agent.is_active or not credentials or not agent.model.strip():
            raise HTTPException(409, "Agent is not ready. Configure its model and provider key.")
        if not event.reply:
            routed = await dispatch_prepare(agency_id=channel.agency_id, conversation=conversation,
                message_id=message_id, entry_agent=agent)
            if routed is not None and routed.prepared is None:
                # A published policy routes this agent but the turn ended without a
                # reply (human handoff, hop limit, or a failure already marked
                # uncertain): never fall back to the direct single-agent path here.
                event.status = "ignored"
                db.commit()
                return True
            if routed is not None:
                event.reply = routed.prepared.content
            else:
                knowledge = await retrieve_knowledge(db, agent, event.text)
                history = db.scalars(select(Message).where(Message.conversation_id == conversation.id)
                    .order_by(Message.created_at.desc()).limit(agent.memory_limit or 30)).all()
                base_url, key = credentials
                completion = await chat_completion(agent.provider, base_url, key, agent.model.strip(),
                    [{"role": "system", "content": build_system_prompt(agent, knowledge.text)},
                     *[{"role": msg.role, "content": msg.content} for msg in reversed(history)]],
                    temperature=agent.temperature, max_tokens=agent.max_tokens)
                record_usage(db, agent.agency_id, agent.id, agent.provider, agent.model.strip(), completion)
                if not completion.text.strip() or len(completion.text) > 1000:
                    raise HTTPException(409, "Agent response is empty or exceeds the social channel limit. Human reply required.")
                event.reply = completion.text
        # Lock only after slow generation: a completed takeover suppresses the reply.
        db.refresh(conversation, with_for_update={"of": Conversation})
        if conversation.mode == "human":
            db.commit()  # Release the conversation lock: dispatch_abort() acquires its own.
            if routed is not None:
                await dispatch_abort(routed)
            event.status = "ignored"
            db.commit()
            return True
        event.route_state = serialize(routed)
        event.status, event.last_error = "ready", None
        db.commit()  # Generated text is durable before attempting any external send.
    except Exception:
        db.commit()  # Release the conversation lock (if held): dispatch_abort() acquires its own.
        if routed is not None:
            await dispatch_abort(routed)
        # No secret-bearing exception strings. Committing preserves the inbound message.
        event.status = "failed"
        event.last_error = "Reply preparation failed. Check agent configuration and reply from Inbox. No message was sent."
        db.commit()
        return True

    # Another worker can claim ready jobs, so claim again and hold conversation
    # lock through delivery. Takeover cannot acknowledge while a send is in flight.
    event = db.scalar(select(SocialEvent).where(SocialEvent.id == event.id).with_for_update())
    if event.status != "ready":
        db.rollback()
        return True
    db.refresh(channel)
    db.refresh(conversation, with_for_update={"of": Conversation})
    if conversation.mode == "human" or not channel.is_enabled:
        db.commit()  # Release the conversation lock: dispatch_abort() acquires its own.
        await _release_route(event)
        event.status = "ignored"
        db.commit()
        return True
    event.status, event.updated_at = "sending", now_utc()
    db.commit()
    db.refresh(conversation, with_for_update={"of": Conversation})
    try:
        db.refresh(channel)
        db.refresh(agency)
        db.refresh(channel.client)
        db.refresh(channel.agent)
        if conversation.mode == "human" or not agency.is_active or not channel.client.is_active or not channel.agent.is_active or not channel.is_enabled:
            db.commit()
            await _release_route(event)
            event.status = "ignored"
        else:
            db.commit()  # No open lock during external I/O or dispatch_finalize()'s own lock.
            ensure_send_allowed(db, channel, conversation)
            external = await send_text(channel, event.sender_id, event.reply)
            routed = deserialize(event.route_state)
            if routed is not None:
                await dispatch_finalize(routed, external_message_id=external)
            else:
                db.add(Message(conversation_id=conversation.id, role="assistant", content=event.reply,
                    sender_type="ai", sender_name=channel.agent.name, external_message_id=external))
            conversation.updated_at = now_utc()
            event.status = "sent"
    except Exception:
        db.commit()  # Release the conversation lock (if held): dispatch_abort() acquires its own.
        await _release_route(event)
        event.status, event.last_error = "uncertain", "Delivery not confirmed. Check the external conversation before replying; automatic retry is disabled."
    event.updated_at = now_utc()
    db.commit()
    return True
