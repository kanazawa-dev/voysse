"""Official Instagram Login/Messenger APIs; no private API or browser automation."""
from datetime import timedelta

import httpx
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Conversation, Message, SocialChannel, now_utc
from ..security import decrypt_secret


def graph_root(platform: str) -> str:
    settings = get_settings()
    return (settings.meta_instagram_graph_base_url if platform == "instagram" else settings.meta_graph_base_url).rstrip("/")


async def graph(channel: SocialChannel, method: str, path: str, **kwargs) -> dict:
    try:
        async with httpx.AsyncClient(timeout=25, follow_redirects=False) as client:
            response = await client.request(method, f"{graph_root(channel.platform)}/{path}",
                headers={"Authorization": f"Bearer {decrypt_secret(channel.encrypted_access_token)}"}, **kwargs)
        if response.status_code >= 400:
            # Meta error descriptions can include request details. Keep secrets out.
            raise HTTPException(502, f"Meta rejected the request (HTTP {response.status_code}). Check permissions and account access.")
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Meta response unavailable or invalid. Verify delivery before retrying.") from exc


async def verify_account(channel: SocialChannel) -> dict:
    fields = "id,username" if channel.platform == "instagram" else "id,name"
    # /me binds the token to THIS account, rather than checking a public profile.
    profile = await graph(channel, "GET", "me", params={"fields": fields})
    if str(profile.get("id")) != channel.account_id:
        raise HTTPException(400, "The access token belongs to a different account.")
    return profile


def ensure_send_allowed(db: Session, channel: SocialChannel, conversation: Conversation):
    if not channel.is_enabled or channel.status not in ("awaiting_message", "connected"):
        raise HTTPException(409, "The social channel is disconnected.")
    if channel.client_id != conversation.client_id or channel.agency_id != conversation.agency_id:
        raise HTTPException(409, "Invalid channel destination.")
    last_inbound = db.scalar(select(func.max(Message.created_at)).where(
        Message.conversation_id == conversation.id, Message.sender_type == "visitor"))
    if not last_inbound or last_inbound < now_utc() - timedelta(hours=24):
        raise HTTPException(409, "The 24-hour reply window has closed. Wait for a new customer message.")


async def send_text(channel: SocialChannel, recipient: str, content: str) -> str:
    if not content.strip() or len(content) > 1000:
        raise HTTPException(400, "Social replies must contain between 1 and 1000 characters.")
    payload = {"recipient": {"id": recipient}, "message": {"text": content}}
    if channel.platform == "messenger":
        payload["messaging_type"] = "RESPONSE"
    result = await graph(channel, "POST", f"{channel.account_id}/messages", json=payload)
    if not result.get("message_id"):
        raise HTTPException(502, "Meta did not confirm a message ID. Verify delivery before retrying.")
    return str(result["message_id"])
