"""Durable QR processing. Ambiguous tool/send effects are never replayed."""
import base64
from datetime import timedelta

from sqlalchemy import case, or_, select, text

from ..models import Agency, Conversation, Message, WhatsAppChannel, WhatsAppQREvent, now_utc
from .whatsapp import bridge_command
from .whatsapp_inbound import InboundMessage, process_inbound


def active(db, channel):
    return (channel.is_enabled and channel.agent.is_active and channel.client.is_active
            and db.get(Agency, channel.agency_id).is_active)


def same_destination(channel, event):
    return (event.payload["agent_id"] == str(channel.agent_id)
            and event.payload["source_phone_number"] == channel.phone_number)


def finish(db, event, status, error=None):
    event.status, event.error_code, event.updated_at = status, error, now_utc()
    if status in {"needs_review", "uncertain"}:
        conversation = db.scalar(select(Conversation).where(
            Conversation.whatsapp_channel_id == event.channel_id,
            Conversation.external_chat_id == event.payload["remote_jid"],
        ).with_for_update(of=Conversation))
        if conversation:
            event.conversation_id = conversation.id
            conversation.mode = "human"
    db.commit()


async def work_once(db):
    candidates = db.scalars(select(WhatsAppQREvent.channel_id).join(WhatsAppChannel).where(
        WhatsAppQREvent.status.in_(("queued", "preparing", "ready", "sending")),
        or_(WhatsAppChannel.status == "connected", WhatsAppChannel.is_enabled.is_(False),
            WhatsAppQREvent.status.in_(("preparing", "sending"))),
    ).distinct().limit(32)).all()
    # Hold a dedicated session lock across the pipeline's transaction commits.
    with db.get_bind().connect() as lock:
        for channel_id in candidates:
            key = "qr:" + str(channel_id)
            if not lock.scalar(text("SELECT pg_try_advisory_lock(hashtextextended(:key, 0))"), {"key": key}):
                continue
            try:
                if await _locked_work(db, channel_id):
                    return True
            finally:
                lock.execute(text("SELECT pg_advisory_unlock(hashtextextended(:key, 0))"), {"key": key})
    db.rollback()
    return False


async def _locked_work(db, channel_id):
    channel = db.get(WhatsAppChannel, channel_id)
    if not channel:
        return False
    abandoned = db.scalars(select(WhatsAppQREvent).where(
        WhatsAppQREvent.channel_id == channel_id,
        WhatsAppQREvent.status.in_(("preparing", "sending")),
    )).all()
    for event in abandoned:
        preparing = event.status == "preparing"
        finish(db, event, "needs_review" if preparing else "uncertain",
               "preparation_interrupted" if preparing else "delivery_unknown")
    event = db.scalar(select(WhatsAppQREvent).where(
        WhatsAppQREvent.channel_id == channel_id, WhatsAppQREvent.status.in_(("queued", "ready")),
    ).order_by(case((WhatsAppQREvent.status == "ready", 0), else_=1),
               WhatsAppQREvent.received_at, WhatsAppQREvent.id).limit(1))
    if not event:
        return bool(abandoned)
    event_id = event.id
    if not active(db, channel):
        finish(db, event, "ignored", "destination_inactive")
        return True
    if channel.status != "connected":
        db.rollback()
        return bool(abandoned)
    if not same_destination(channel, event):
        finish(db, event, "needs_review", "destination_changed")
        return True
    # Internal freshness policy, not a claim about WhatsApp QR platform rules.
    if event.received_at < now_utc() - timedelta(hours=24):
        finish(db, event, "needs_review", "queue_expired")
        return True
    if event.status == "queued":
        finish(db, event, "preparing")
        try:
            data = event.payload
            missing_media = bool(data["media_kind"] and not data["media_base64"])
            result = await process_inbound(db, channel, InboundMessage(
                external_message_id=event.external_id, external_chat_id=data["remote_jid"],
                sender_name=data["sender_name"], text=data["text"], media_kind=data["media_kind"],
                media_bytes=base64.b64decode(data["media_base64"], validate=True) if data["media_base64"] else None,
                media_mime=data["media_mime"], received_at=event.received_at,
            ), conversation_channel="whatsapp", channel_fk_field="whatsapp_channel_id",
                persist_reply=False, generate_reply=not missing_media)
            event.conversation_id = result.conversation_id
            if missing_media:
                finish(db, event, "needs_review", "media_unavailable")
            elif not result.accepted or result.mode == "human":
                finish(db, event, "ignored", "human_or_inactive")
            elif not result.reply or not result.reply.strip():
                finish(db, event, "needs_review", "preparation_failed")
            elif len(result.reply) > 4096:
                finish(db, event, "needs_review", "reply_too_long")
            else:
                event.reply = result.reply
                event.reply_metadata = {"sources": result.sources, "tool_calls": result.tool_calls,
                                         "responder_name": result.responder_name}
                finish(db, event, "ready")
        except Exception:
            db.rollback()
            finish(db, db.get(WhatsAppQREvent, event_id), "needs_review", "preparation_failed")
            return True
    if event.status != "ready":
        return True
    conversation = db.get(Conversation, event.conversation_id)
    if not conversation:
        finish(db, event, "needs_review", "conversation_unavailable")
        return True
    db.refresh(conversation, with_for_update={"of": Conversation})
    db.expire_all()
    if conversation.mode == "human" or not active(db, channel):
        finish(db, event, "ignored", "human_or_inactive")
        return True
    if not same_destination(channel, event):
        finish(db, event, "needs_review", "destination_changed")
        return True
    if channel.status != "connected":
        db.rollback()
        return True  # Persisted ready reply waits for reconnection, without regeneration.
    finish(db, event, "sending")
    try:
        db.refresh(conversation, with_for_update={"of": Conversation})
        db.refresh(channel, with_for_update={"of": WhatsAppChannel})
        db.expire_all()
        if conversation.mode == "human" or not active(db, channel) or not same_destination(channel, event):
            finish(db, event, "ignored", "human_or_inactive")
            return True
        response = await bridge_command("POST", f"/channels/{channel.id}/send", {
            "remote_jid": event.payload["remote_jid"], "text": event.reply,
            "expected_phone_number": event.payload["source_phone_number"],
        })
        external = response.get("external_message_id")
        if not isinstance(external, str) or not external.strip() or len(external) > 255:
            raise ValueError("Missing confirmation")
        db.add(Message(conversation_id=conversation.id, role="assistant", content=event.reply,
                       sender_type="ai", sender_name=event.reply_metadata.get("responder_name") or channel.agent.name, external_message_id=external,
                       sources=event.reply_metadata.get("sources", []), tool_calls=event.reply_metadata.get("tool_calls")))
        conversation.updated_at = now_utc()
        finish(db, event, "sent")
    except Exception:
        db.rollback()
        finish(db, db.get(WhatsAppQREvent, event_id), "uncertain", "delivery_unknown")
    return True
