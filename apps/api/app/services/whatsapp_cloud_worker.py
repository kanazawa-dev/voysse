"""Durable Cloud-only worker. Never replay unknown tool or send effects."""
from datetime import timedelta

from sqlalchemy import case, select, text
from sqlalchemy.orm import Session

from ..models import Agency, Conversation, Message, WhatsAppCloudChannel, WhatsAppCloudEvent, now_utc
from ..security import decrypt_secret
from .execution_dispatch import deserialize, dispatch_abort, dispatch_finalize
from .whatsapp_cloud import fetch_media, send_text
from .whatsapp_inbound import InboundMessage, process_inbound


def active(db, channel):
    agency = db.get(Agency, channel.agency_id)
    return channel.agent.is_active and channel.is_enabled and channel.client.is_active and agency and agency.is_active


async def _release_route(event):
    """Release a claimed-but-unfinalized route before a ready event is given up
    on (never sent). Not called when the reply stays valid for a later retry."""
    routed = deserialize((event.reply_metadata or {}).get("route"))
    if routed is not None:
        await dispatch_abort(routed)


def require_human_review(db, event):
    conversation = db.get(Conversation, event.conversation_id) if event.conversation_id else db.scalar(
        select(Conversation).where(
            Conversation.whatsapp_cloud_channel_id == event.channel_id,
            Conversation.external_chat_id == event.payload["sender"],
        ))
    if conversation:
        event.conversation_id = conversation.id
        conversation.mode = "human"


async def work_once(db: Session) -> bool:
    candidates = db.scalars(select(WhatsAppCloudEvent.channel_id).where(
        WhatsAppCloudEvent.status.in_(("queued", "preparing", "ready", "sending"))
    ).distinct().limit(32)).all()
    # A separate checked-out connection keeps this SESSION advisory lock stable
    # across process_inbound's commits. A process crash releases it at PostgreSQL.
    with db.get_bind().connect() as lock:
        for channel_id in candidates:
            key = "cloud:" + str(channel_id)
            if not lock.scalar(text("SELECT pg_try_advisory_lock(hashtextextended(:key, 0))"), {"key": key}):
                continue
            try:
                return await _locked_work(db, channel_id)
            finally:
                lock.execute(text("SELECT pg_advisory_unlock(hashtextextended(:key, 0))"), {"key": key})
    db.rollback()
    return False


async def _locked_work(db, channel_id):
    channel = db.get(WhatsAppCloudChannel, channel_id)
    if not channel:
        db.rollback()
        return False
    # Owning the lock proves no other worker is still generating/sending here.
    abandoned = db.scalars(select(WhatsAppCloudEvent).where(
        WhatsAppCloudEvent.channel_id == channel_id,
        WhatsAppCloudEvent.status.in_(("preparing", "sending")),
    )).all()
    for job in abandoned:
        if job.status == "sending":
            await _release_route(job)  # A route claimed before the crash must not stay claimed forever.
        job.error_code = "preparation_interrupted" if job.status == "preparing" else "delivery_unknown"
        job.status = "needs_review" if job.status == "preparing" else "uncertain"
        conversation = db.scalar(select(Conversation).where(
            Conversation.whatsapp_cloud_channel_id == channel_id,
            Conversation.external_chat_id == job.payload["sender"],
        ))
        if conversation:
            job.conversation_id = conversation.id
        require_human_review(db, job)
        job.updated_at = now_utc()
    db.commit()
    event = db.scalar(select(WhatsAppCloudEvent).where(
        WhatsAppCloudEvent.channel_id == channel_id,
        WhatsAppCloudEvent.status.in_(("queued", "ready")),
    ).order_by(case((WhatsAppCloudEvent.status == "ready", 0), else_=1),
               WhatsAppCloudEvent.received_at, WhatsAppCloudEvent.updated_at, WhatsAppCloudEvent.id).limit(1))
    if not event:
        return bool(abandoned)
    if (event.payload["phone_number_id"] != channel.phone_number_id or event.payload["agent_id"] != str(channel.agent_id)):
        event.status, event.error_code = "needs_review", "destination_changed"
        db.commit()
        return True
    if not active(db, channel):
        event.status, event.error_code = "ignored", "destination_inactive"
        db.commit()
        return True
    if event.status == "queued":
        event.status = "preparing"
        db.commit()  # If preparation/tools crash, never execute them blindly again.
        try:
            data = event.payload
            reason = None
            if data["kind"] == "unsupported":
                reason = "unsupported_content"
            elif event.received_at < now_utc() - timedelta(hours=24):
                reason = "reply_window_closed"
            inbound = InboundMessage(
                external_message_id=event.external_id, external_chat_id=data["sender"],
                sender_name=data["name"], text=data["text"] or ("[Contenido no soportado]" if reason == "unsupported_content" else ""),
                media_kind=data["kind"] if data["kind"] in ("image", "audio") else None,
                media_mime=data["mime"], received_at=event.received_at,
            )
            if inbound.media_kind and not reason:
                try:
                    if not data["media_id"]:
                        raise ValueError("Missing media")
                    inbound.media_bytes, inbound.media_mime = await fetch_media(
                        decrypt_secret(channel.encrypted_access_token), data["media_id"])
                except Exception:
                    reason = "media_unavailable"
            result = await process_inbound(db, channel, inbound,
                conversation_channel="whatsapp_cloud", channel_fk_field="whatsapp_cloud_channel_id",
                persist_reply=False, generate_reply=not reason)
            event.conversation_id = result.conversation_id
            if reason:
                event.status, event.error_code = "needs_review", reason
                if result.conversation_id and reason != "reply_window_closed":
                    db.get(Conversation, result.conversation_id).mode = "human"
            elif not result.accepted or result.mode == "human":
                event.status = "ignored"
            elif not result.reply:
                event.status, event.error_code = "needs_review", "preparation_failed"
            elif not result.reply.strip() or len(result.reply) > 4096:
                if result.route is not None:
                    await dispatch_abort(deserialize(result.route))
                event.status, event.error_code = "needs_review", "reply_too_long"
            else:
                event.reply, event.status = result.reply, "ready"
                event.reply_metadata = {"sources": result.sources, "tool_calls": result.tool_calls,
                                         "responder_name": result.responder_name, "route": result.route}
            if event.status == "needs_review":
                require_human_review(db, event)
            event.updated_at = now_utc()
            db.commit()
        except Exception:
            db.rollback()
            event = db.get(WhatsAppCloudEvent, event.id)
            event.status, event.error_code = "needs_review", "preparation_failed"
            require_human_review(db, event)
            event.updated_at = now_utc()
            db.commit()
            return True
    if event.status != "ready":
        return True
    conversation = db.get(Conversation, event.conversation_id)
    if not conversation:
        await _release_route(event)
        event.status, event.error_code = "needs_review", "conversation_unavailable"
        db.commit()
        return True
    db.refresh(conversation, with_for_update={"of": Conversation})
    db.refresh(channel)
    if conversation.mode == "human" or not active(db, channel) or (event.payload["phone_number_id"] != channel.phone_number_id or event.payload["agent_id"] != str(channel.agent_id)):
        db.commit()  # Release the conversation lock: dispatch_abort() acquires its own.
        await _release_route(event)
        event.status, event.error_code = "ignored", "human_or_inactive"
        db.commit()
        return True
    if event.received_at < now_utc() - timedelta(hours=24):
        db.commit()
        await _release_route(event)
        event.status, event.error_code = "needs_review", "reply_window_closed"
        db.commit()
        return True
    event.status, event.updated_at = "sending", now_utc()
    db.commit()  # Ambiguous after this point; no automatic resend.
    db.refresh(conversation, with_for_update={"of": Conversation})
    db.expire_all()
    try:
        if conversation.mode == "human" or not active(db, channel) or (event.payload["phone_number_id"] != channel.phone_number_id or event.payload["agent_id"] != str(channel.agent_id)):
            db.commit()  # Release the conversation lock: dispatch_abort() acquires its own.
            await _release_route(event)
            event.status, event.error_code = "ignored", "human_or_inactive"
        else:
            db.commit()  # No open lock during external I/O or dispatch_finalize()'s own lock.
            external = await send_text(decrypt_secret(channel.encrypted_access_token),
                                       channel.phone_number_id, event.payload["sender"], event.reply)
            if not external:
                raise ValueError("Missing message ID")
            routed = deserialize(event.reply_metadata.get("route"))
            if routed is not None:
                await dispatch_finalize(routed, external_message_id=external)
            else:
                db.add(Message(conversation_id=conversation.id, role="assistant", content=event.reply,
                               sender_type="ai", sender_name=event.reply_metadata.get("responder_name") or channel.agent.name,
                               external_message_id=external, sources=event.reply_metadata.get("sources", []),
                               tool_calls=event.reply_metadata.get("tool_calls")))
            event.status, event.error_code = "sent", None
            conversation.updated_at = now_utc()
        event.updated_at = now_utc()
        db.commit()
    except Exception:
        db.rollback()
        event = db.get(WhatsAppCloudEvent, event.id)
        await _release_route(event)
        event.status, event.error_code = "uncertain", "delivery_unknown"
        require_human_review(db, event)
        event.updated_at = now_utc()
        db.commit()
    return True
