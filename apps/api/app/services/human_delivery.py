"""Persist before network I/O; idempotent local requests, not exactly-once delivery."""
import uuid
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from ..models import Agency, Client, Conversation, HumanDelivery, Message, SocialChannel, User, WhatsAppChannel, WhatsAppCloudChannel, now_utc
from ..schemas import HumanDeliveryOut
from .social import ensure_send_allowed
from .whatsapp import send_channel_message

EXTERNAL_CHANNELS = {"whatsapp", "whatsapp_cloud", "instagram", "messenger"}


def delivery_output(attempt: HumanDelivery) -> HumanDeliveryOut:
    output = HumanDeliveryOut.model_validate(attempt)
    if output.status == "sending" and output.updated_at < now_utc() - timedelta(minutes=2):
        output.status = "uncertain"
        output.error_code = "confirmation_missing"
    return output


def conversation_deliveries(db: Session, conversation_id: uuid.UUID):
    # Bounded response; records remain in DB. Errors/pending kept separate from
    # Message so AI and customer-visible history never claim they were sent.
    return [delivery_output(row) for row in db.scalars(select(HumanDelivery).where(
        HumanDelivery.conversation_id == conversation_id
    ).order_by(HumanDelivery.created_at.desc()).limit(50))]


def preflight(db: Session, conversation: Conversation, content: str) -> str | None:
    if not content:
        return "empty_message"
    if conversation.mode != "human":
        return "human_control_required"
    agency = db.get(Agency, conversation.agency_id)
    customer = db.get(Client, conversation.client_id)
    if not agency or not agency.is_active or not customer or not customer.is_active:
        return "destination_inactive"
    if conversation.channel not in EXTERNAL_CHANNELS:
        return None if conversation.channel in {"widget", "playground"} else "unsupported_channel"
    if not conversation.external_chat_id:
        return "destination_unavailable"
    if conversation.channel in {"instagram", "messenger"}:
        channel = db.get(SocialChannel, conversation.social_channel_id) if conversation.social_channel_id else None
        if len(content) > 1000:
            return "message_too_long"
        if not channel or channel.platform != conversation.channel or not channel.encrypted_access_token:
            return "destination_unavailable"
        try:
            ensure_send_allowed(db, channel, conversation)
        except HTTPException:
            return "channel_or_window_unavailable"
    elif conversation.channel == "whatsapp_cloud":
        channel = db.get(WhatsAppCloudChannel, conversation.whatsapp_cloud_channel_id) if conversation.whatsapp_cloud_channel_id else None
        if len(content) > 4096:
            return "message_too_long"
        if not channel or not channel.is_enabled or channel.status != "connected" or not channel.encrypted_access_token or not channel.phone_number_id:
            return "destination_unavailable"
        latest = db.scalar(select(func.max(func.coalesce(Message.external_received_at, Message.created_at))).where(
            Message.conversation_id == conversation.id, Message.sender_type == "visitor"))
        if not latest or latest < now_utc() - timedelta(hours=24):
            return "reply_window_closed"
    else:
        channel = db.get(WhatsAppChannel, conversation.whatsapp_channel_id) if conversation.whatsapp_channel_id else None
        if not channel or not channel.is_enabled or channel.status != "connected":
            return "destination_unavailable"
    if channel.agency_id != conversation.agency_id or channel.client_id != conversation.client_id:
        return "destination_unavailable"
    return None


async def deliver_human(db: Session, user: User | Client, conversation_id: uuid.UUID, request_id: uuid.UUID, content: str):
    content = content.strip()
    is_portal = isinstance(user, Client)
    actor_id = None if is_portal else user.id
    portal_client_id = user.id if is_portal else None
    conversation = db.scalar(select(Conversation).where(
        Conversation.id == conversation_id, Conversation.agency_id == user.agency_id,
        *([Conversation.client_id == user.id] if is_portal else []),
    ).execution_options(populate_existing=True))
    if not conversation:
        raise HTTPException(404, "Conversation not found")
    existing = db.get(HumanDelivery, request_id)
    if existing:
        if existing.conversation_id != conversation.id or existing.content != content or existing.actor_id != actor_id or existing.portal_client_id != portal_client_id:
            raise HTTPException(409, "Request ID already used; do not reuse it for another message")
        # Repeating a key only observes the outcome, never resends, even on error.
        return
    try:
        db.refresh(conversation, with_for_update={"of": Conversation, "nowait": True})
    except OperationalError as exc:
        db.rollback()
        if getattr(exc.orig, "sqlstate", None) == "55P03":
            raise HTTPException(409, "Conversation is busy; check again with the same request ID")
        raise
    # Recheck after the lock for another process that just committed this key.
    existing = db.get(HumanDelivery, request_id)
    if existing:
        if existing.conversation_id != conversation.id or existing.content != content or existing.actor_id != actor_id or existing.portal_client_id != portal_client_id:
            raise HTTPException(409, "Request ID already used; do not reuse it for another message")
        return
    attempt = HumanDelivery(
        id=request_id, conversation_id=conversation.id, actor_id=actor_id, portal_client_id=portal_client_id,
        sender_name=user.name, content=content, status="sending",
    )
    error = preflight(db, conversation, content)
    if is_portal:
        db.refresh(user)
        if not user.portal_enabled:
            error = "portal_disabled"
    if error:
        attempt.status, attempt.error_code = "failed", error
    db.add(attempt)
    conversation.updated_at = now_utc()
    try:
        db.commit()  # durable BEFORE calling the channel
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Request ID already used")
    if error:
        return

    # Serializes with takeover/return-to-AI writes until this send resolves.
    # The pre-send commit lets another request observe sending after a crash.
    try:
        db.refresh(conversation, with_for_update={"of": Conversation, "nowait": True})
    except OperationalError as exc:
        db.rollback()
        if getattr(exc.orig, "sqlstate", None) != "55P03":
            raise
        attempt = db.get(HumanDelivery, request_id)
        attempt.status, attempt.error_code = "failed", "conversation_busy"
        db.commit()
        return
    # expire cached destinations so disconnect/suspension before dispatch is seen.
    db.expire_all()
    error = preflight(db, conversation, content)
    if is_portal:
        db.refresh(user)
        if not user.portal_enabled:
            error = "portal_disabled"
    if error:
        attempt.status, attempt.error_code = "failed", error
        db.commit()
        return
    try:
        external_id = await send_channel_message(db, conversation, content)
        if conversation.channel in EXTERNAL_CHANNELS and not external_id:
            raise ValueError("Missing channel acknowledgement")
    except Exception:
        # Even an HTTP error can follow a successful upstream send. Never log
        # provider exception strings: they can echo tokens or message content.
        attempt.status, attempt.error_code = "uncertain", "confirmation_missing"
        db.commit()
        return
    db.add(Message(
        conversation_id=conversation.id, role="assistant", content=content,
        sender_type="human", sender_name=attempt.sender_name,
        external_message_id=external_id,
    ))
    attempt.status = "confirmed" if conversation.channel in EXTERNAL_CHANNELS else "published"
    attempt.external_message_id = external_id
    conversation.updated_at = now_utc()
    db.commit()
