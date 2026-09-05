"""Public webhook for the WhatsApp Cloud API channel.

Meta calls these endpoints directly: a GET handshake when the webhook is
registered, and signed POSTs for inbound traffic. POST bodies are verified
with HMAC-SHA256 over the raw bytes using the channel's app secret, so the
payload is parsed only after the signature check passes.
"""

import hashlib
import hmac
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from datetime import datetime, timezone

from ..database import get_db
from ..models import Agency, WhatsAppCloudChannel, WhatsAppCloudEvent, now_utc
from ..ratelimit import whatsapp_cloud_webhook_rate_limit
from ..security import decrypt_secret


public_router = APIRouter(prefix="/public/whatsapp-cloud", tags=["WhatsApp Cloud public"])


def _channel(db: Session, channel_id: uuid.UUID) -> WhatsAppCloudChannel:
    channel = db.get(WhatsAppCloudChannel, channel_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Unknown channel")
    return channel


@public_router.get("/channels/{channel_id}/webhook")
def verify_webhook(
    channel_id: uuid.UUID,
    db: Session = Depends(get_db),
    hub_mode: str = Query(default="", alias="hub.mode"),
    hub_verify_token: str = Query(default="", alias="hub.verify_token"),
    hub_challenge: str = Query(default="", alias="hub.challenge"),
):
    channel = _channel(db, channel_id)
    if (
        hub_mode != "subscribe"
        or not channel.webhook_verify_token
        or not hmac.compare_digest(hub_verify_token, channel.webhook_verify_token)
    ):
        raise HTTPException(status_code=403, detail="Verification failed")
    return PlainTextResponse(hub_challenge)


def _items(value):
    return value if isinstance(value, list) else []


@public_router.post(
    "/channels/{channel_id}/webhook",
    dependencies=[Depends(whatsapp_cloud_webhook_rate_limit)],
)
async def receive_webhook(channel_id: uuid.UUID, request: Request, db: Session = Depends(get_db)):
    channel = _channel(db, channel_id)
    if not channel.encrypted_app_secret:
        raise HTTPException(status_code=403, detail="Channel is not configured")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 1024 * 1024:
            raise HTTPException(413, "Webhook too large")
    raw = bytes(raw)
    app_secret = decrypt_secret(channel.encrypted_app_secret)
    expected = "sha256=" + hmac.new(app_secret.encode(), raw, hashlib.sha256).hexdigest()
    signature = request.headers.get("X-Hub-Signature-256") or ""
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = json.loads(raw)
    except ValueError:
        raise HTTPException(400, "Invalid webhook JSON")
    if not isinstance(payload, dict) or payload.get("object") != "whatsapp_business_account":
        raise HTTPException(400, "Invalid webhook object")
    if not channel.is_enabled or not channel.client.is_active or not db.get(Agency, channel.agency_id).is_active:
        return {"status": "ok"}
    for entry in _items(payload.get("entry")):
        if not isinstance(entry, dict):
            continue
        for change in _items(entry.get("changes")):
            if not isinstance(change, dict) or change.get("field") != "messages":
                continue
            value = change.get("value")
            if not isinstance(value, dict):
                continue
            metadata = value.get("metadata") or {}
            if not isinstance(metadata, dict) or str(metadata.get("phone_number_id")) != channel.phone_number_id:
                continue
            contacts = {}
            for contact in _items(value.get("contacts")):
                if isinstance(contact, dict) and isinstance(contact.get("profile"), dict):
                    contacts[str(contact.get("wa_id"))] = str(contact["profile"].get("name") or "")[:160]
            for message in _items(value.get("messages")):
                if not isinstance(message, dict):
                    continue
                mid, sender = message.get("id"), message.get("from")
                if not isinstance(mid, str) or not 1 <= len(mid) <= 255 or not isinstance(sender, str) or not sender.isdigit() or len(sender) > 80:
                    continue
                kind = message.get("type")
                detail = message.get(kind) if isinstance(kind, str) else None
                detail = detail if isinstance(detail, dict) else {}
                body = detail.get("body") if kind == "text" else detail.get("caption", "")
                body = body if isinstance(body, str) else ""
                supported = kind in ("text", "image", "audio") and len(body) <= 10000
                try:
                    received = min(datetime.fromtimestamp(int(message["timestamp"]), timezone.utc), now_utc())
                except (KeyError, ValueError, TypeError, OverflowError, OSError):
                    # Never extend the reply window for a missing provider timestamp.
                    received = datetime.fromtimestamp(0, timezone.utc)
                normalized = {
                    "phone_number_id": channel.phone_number_id,
                    "agent_id": str(channel.agent_id),
                    "sender": sender, "name": contacts.get(sender), "text": body[:10000],
                    "kind": kind if supported else "unsupported",
                    "media_id": str(detail.get("id") or "")[:255],
                    "mime": str(detail.get("mime_type") or "")[:120],
                }
                db.execute(insert(WhatsAppCloudEvent).values(
                    id=uuid.uuid4(), channel_id=channel.id, external_id=mid,
                    payload=normalized, reply_metadata={}, status="queued", received_at=received, updated_at=now_utc(),
                ).on_conflict_do_nothing(constraint="uq_cloud_event_external"))
    # Never acknowledge failed storage: non-2xx lets the provider retry safely.
    db.commit()
    return {"status": "ok"}
