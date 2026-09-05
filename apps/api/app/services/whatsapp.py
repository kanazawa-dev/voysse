import uuid

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Conversation, SocialChannel, WhatsAppCloudChannel
from ..security import decrypt_secret
from .whatsapp_cloud import send_text


async def bridge_command(method: str, path: str, payload: dict | None = None) -> dict:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(
                method,
                f"{settings.whatsapp_bridge_url.rstrip('/')}{path}",
                headers={"X-Bridge-Token": settings.whatsapp_bridge_token},
                json=payload,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail="The local WhatsApp service is not available. Start it with npm run dev inside whatsapp/.",
        ) from exc
    if response.status_code >= 400:
        try:
            detail = response.json().get("error")
        except ValueError:
            detail = None
        raise HTTPException(status_code=502, detail=detail or "WhatsApp could not complete the operation")
    if response.status_code == 204:
        return {}
    return response.json()


async def send_channel_message(db: Session, conversation: Conversation, content: str) -> str | None:
    """Deliver an operator message through the conversation's channel. Returns
    the external message id, or None for channels without outbound delivery."""
    if conversation.channel in ("instagram", "messenger"):
        from .social import ensure_send_allowed, send_text as send_social_text
        channel = db.get(SocialChannel, conversation.social_channel_id) if conversation.social_channel_id else None
        if not channel or not conversation.external_chat_id:
            raise HTTPException(409, "Social destination unavailable")
        ensure_send_allowed(db, channel, conversation)
        return await send_social_text(channel, conversation.external_chat_id, content)
    if conversation.channel == "whatsapp":
        if not conversation.whatsapp_channel_id or not conversation.external_chat_id:
            raise HTTPException(status_code=409, detail="This conversation does not have a valid WhatsApp destination")
        result = await bridge_command(
            "POST",
            f"/channels/{conversation.whatsapp_channel_id}/send",
            {"remote_jid": conversation.external_chat_id, "text": content},
        )
        return result.get("external_message_id")
    if conversation.channel == "whatsapp_cloud":
        if not conversation.whatsapp_cloud_channel_id or not conversation.external_chat_id:
            raise HTTPException(status_code=409, detail="This conversation does not have a valid WhatsApp destination")
        channel = db.get(WhatsAppCloudChannel, conversation.whatsapp_cloud_channel_id)
        if not channel or not channel.encrypted_access_token or not channel.phone_number_id:
            raise HTTPException(status_code=409, detail="The WhatsApp API channel is not configured")
        return await send_text(
            decrypt_secret(channel.encrypted_access_token),
            channel.phone_number_id,
            conversation.external_chat_id,
            content,
        )
    return None
