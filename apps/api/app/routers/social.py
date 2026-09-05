import hashlib
import hmac
import json
import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_user
from ..models import Agency, Agent, Client, SocialChannel, SocialEvent, User, new_uuid, now_utc
from ..security import encrypt_secret
from ..services.social import graph, verify_account

Platform = Literal["instagram", "messenger"]
router = APIRouter(prefix="/social", tags=["Social channels"])
public_router = APIRouter(prefix="/public/social", tags=["Social webhooks"])


class Configure(BaseModel):
    agent_id: uuid.UUID
    account_id: str = Field(pattern=r"^[0-9]{1,80}$")
    access_token: str | None = Field(default=None, max_length=4096)


def owned(db, user, client_id, platform):
    row = db.scalar(select(SocialChannel).where(SocialChannel.client_id == client_id,
        SocialChannel.agency_id == user.agency_id, SocialChannel.platform == platform))
    if not row:
        raise HTTPException(404, "Channel not configured")
    return row


def public(row):
    return {key: getattr(row, key) for key in (
        "id", "client_id", "agent_id", "platform", "account_id", "display_name", "status",
        "is_enabled", "last_error", "updated_at")}


@router.get("/channels/{client_id}/{platform}")
def get_channel(client_id: uuid.UUID, platform: Platform, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return public(owned(db, user, client_id, platform))


@router.put("/channels/{client_id}/{platform}")
def configure(client_id: uuid.UUID, platform: Platform, payload: Configure,
              db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    client = db.scalar(select(Client).where(Client.id == client_id, Client.agency_id == user.agency_id))
    agent = db.scalar(select(Agent).where(Agent.id == payload.agent_id, Agent.client_id == client_id, Agent.agency_id == user.agency_id))
    if not client or not agent:
        raise HTTPException(404, "Client or agent not found")
    row = db.scalar(select(SocialChannel).where(SocialChannel.client_id == client_id, SocialChannel.platform == platform))
    token = (payload.access_token or "").strip()
    if not row:
        if not token:
            raise HTTPException(400, "An access token is required")
        row = SocialChannel(client_id=client_id, agency_id=user.agency_id, platform=platform,
            account_id=payload.account_id, agent_id=agent.id, encrypted_access_token=encrypt_secret(token))
        db.add(row)
    elif row.account_id != payload.account_id:
        raise HTTPException(409, "Account identity cannot be changed: preserve its conversation history.")
    if token:
        row.encrypted_access_token = encrypt_secret(token)
    row.agent_id, row.is_enabled, row.status = agent.id, False, "disconnected"
    row.last_error, row.updated_at = None, now_utc()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This account is already configured.")
    return public(row)


@router.post("/channels/{client_id}/{platform}/connect")
async def connect(client_id: uuid.UUID, platform: Platform, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = owned(db, user, client_id, platform)
    settings = get_settings()
    if not settings.meta_social_app_secret or not settings.meta_social_verify_token:
        raise HTTPException(503, "The installation owner must configure the Meta app and webhook first.")
    try:
        profile = await verify_account(row)
        subscription = await graph(row, "POST", f"{row.account_id}/subscribed_apps", params={"subscribed_fields": "messages"})
        if not subscription.get("success"):
            raise HTTPException(502, "Meta did not confirm the webhook subscription.")
    except HTTPException as exc:
        row.status, row.is_enabled, row.last_error = "error", False, str(exc.detail)
    else:
        row.display_name = (profile.get("username") or profile.get("name") or "")[:180]
        row.status, row.is_enabled, row.last_error = "awaiting_message", True, None
    row.updated_at = now_utc()
    db.commit()
    return public(row)


@router.post("/channels/{client_id}/{platform}/disconnect")
def disconnect(client_id: uuid.UUID, platform: Platform, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = owned(db, user, client_id, platform)
    row.is_enabled, row.status, row.updated_at = False, "disconnected", now_utc()
    db.commit()
    return public(row)


@router.get("/channels/{client_id}/{platform}/events")
def events(client_id: uuid.UUID, platform: Platform, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = owned(db, user, client_id, platform)
    items = db.scalars(select(SocialEvent).where(SocialEvent.channel_id == row.id).order_by(SocialEvent.received_at.desc()).limit(30)).all()
    return [{key: getattr(item, key) for key in ("id", "conversation_id", "status", "attempts", "last_error", "updated_at")} for item in items]


@public_router.get("/{platform}/webhook")
def verify(platform: Platform, mode: str = Query("", alias="hub.mode"),
           token: str = Query("", alias="hub.verify_token"), challenge: str = Query("", alias="hub.challenge")):
    expected = get_settings().meta_social_verify_token
    if not expected or mode != "subscribe" or not hmac.compare_digest(token, expected):
        raise HTTPException(403, "Verification failed")
    return PlainTextResponse(challenge)


@router.post("/channels/{client_id}/{platform}/events/{event_id}/retry")
def retry(client_id: uuid.UUID, platform: Platform, event_id: uuid.UUID,
          db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    channel = owned(db, user, client_id, platform)
    item = db.scalar(select(SocialEvent).where(SocialEvent.id == event_id,
        SocialEvent.channel_id == channel.id).with_for_update())
    if not item:
        raise HTTPException(404, "Event not found")
    if item.status != "failed" or item.attempts >= 3:
        raise HTTPException(409, "Only failed preparation can be retried, at most three times. Never retry an uncertain send.")
    item.status, item.last_error, item.updated_at = "queued", None, now_utc()
    db.commit()
    return {"status": "queued"}


@public_router.post("/{platform}/webhook")
async def receive(platform: Platform, request: Request, db: Session = Depends(get_db)):
    secret = get_settings().meta_social_app_secret
    if not secret:
        raise HTTPException(503, "Channel unavailable")
    raw = bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw) > 1024 * 1024:
            raise HTTPException(413, "Payload too large")
    signature = "sha256=" + hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, request.headers.get("x-hub-signature-256", "")):
        raise HTTPException(403, "Invalid signature")
    try:
        payload = json.loads(raw)
        if not isinstance(payload, dict) or payload.get("object") != ("instagram" if platform == "instagram" else "page"):
            raise ValueError()
        entries = payload.get("entry", [])
        if not isinstance(entries, list):
            raise ValueError()
        for entry in entries:
            channel = db.scalar(select(SocialChannel).where(SocialChannel.platform == platform,
                SocialChannel.account_id == str(entry["id"]), SocialChannel.is_enabled.is_(True)))
            if not channel or not channel.client.is_active:
                continue
            agency = db.get(Agency, channel.agency_id)
            if not agency or not agency.is_active:
                continue
            for event in entry.get("messaging", []):
                message = event.get("message") or {}
                if message.get("is_echo") or not message.get("mid"):
                    continue
                sender = str(event.get("sender", {}).get("id", ""))
                recipient = str(event.get("recipient", {}).get("id", ""))
                if not sender.isdigit() or len(sender) > 255 or recipient != channel.account_id or sender == channel.account_id:
                    continue
                if not isinstance(message["mid"], str) or len(message["mid"]) > 255:
                    continue
                received = datetime.fromtimestamp(float(event["timestamp"]) / 1000, tz=timezone.utc)
                received = min(received, now_utc())
                content = message.get("text")
                supported = isinstance(content, str) and bool(content.strip()) and len(content) <= 10000
                db.execute(insert(SocialEvent).values(id=new_uuid(), channel_id=channel.id,
                    external_id=message["mid"], sender_id=sender, received_at=received,
                    text=content if supported else "[Unsupported attachment: human attention required]",
                    supported=supported, status="queued", attempts=0, updated_at=now_utc()
                ).on_conflict_do_nothing(constraint="uq_social_event"))
            channel.status, channel.updated_at = "connected", now_utc()
    except (ValueError, TypeError, KeyError, AttributeError, OverflowError):
        db.rollback()
        raise HTTPException(400, "Invalid webhook payload")
    # Acknowledge only after persistence. DB outages return failure for Meta retry.
    db.commit()
    return {"status": "ok"}
