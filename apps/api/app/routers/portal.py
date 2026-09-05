import asyncio
import uuid

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from ..config import get_settings
from ..database import get_db
from ..models import Agency, Agent, Client, Conversation, Message, now_utc
from ..ratelimit import login_rate_limit
from ..schemas import (
    AgentSummary,
    ConversationDetail,
    ConversationModeUpdate,
    ConversationOut,
    PortalLoginRequest,
    PortalPublicOut,
    PortalSessionOut,
    HumanReplyRequest,
)
from ..security import create_portal_token, decode_portal_token, verify_password
from ..services.human_delivery import conversation_deliveries, deliver_human


router = APIRouter(prefix="/portal", tags=["Client portal"])


def _public_client(db: Session, slug: str) -> Client:
    client = db.scalar(select(Client).where(Client.portal_slug == slug, Client.portal_enabled.is_(True)))
    if not client:
        raise HTTPException(status_code=404, detail="Portal not found or disabled")
    return client


def _portal_client(
    slug: str,
    portal_access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> Client:
    if not portal_access_token:
        raise HTTPException(status_code=401, detail="Sign in to the portal")
    payload = decode_portal_token(portal_access_token)
    if not payload or payload.get("portal_slug") != slug:
        raise HTTPException(status_code=401, detail="The portal session expired")
    try:
        client_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=401, detail="Invalid portal session") from exc
    client = db.scalar(select(Client).where(Client.id == client_id, Client.portal_slug == slug, Client.portal_enabled.is_(True)))
    agency = db.get(Agency, client.agency_id) if client else None
    if not client or not client.is_active or not agency or not agency.is_active:
        raise HTTPException(status_code=401, detail="The portal is no longer available")
    return client


def _detail(db: Session, client: Client, conversation_id: uuid.UUID) -> Conversation:
    conversation = db.scalar(
        select(Conversation)
        .options(selectinload(Conversation.messages), joinedload(Conversation.agent))
        .execution_options(populate_existing=True)
        .where(Conversation.id == conversation_id, Conversation.client_id == client.id)
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


def _visible_detail(db: Session, client: Client, conversation_id: uuid.UUID):
    detail = ConversationDetail.model_validate(_detail(db, client, conversation_id))
    detail.deliveries = conversation_deliveries(db, conversation_id)
    for message in detail.messages:
        message.tool_calls = None
    return detail


@router.get("/{slug}", response_model=PortalPublicOut)
def public_portal(slug: str, db: Session = Depends(get_db)):
    client = _public_client(db, slug)
    agency = db.get(Agency, client.agency_id)
    return {
        "client_name": client.name,
        "portal_title": client.portal_title or f"{client.name} Inbox",
        "portal_slug": client.portal_slug,
        "agency_name": agency.name,
        "agency_brand_color": agency.brand_color,
        "agency_logo_url": f"/api/portal/{slug}/logo" if agency.logo_data else None,
    }


@router.get("/{slug}/logo")
def public_logo(slug: str, db: Session = Depends(get_db)):
    client = _public_client(db, slug)
    agency = db.get(Agency, client.agency_id)
    if not agency.logo_data or not agency.logo_mime:
        raise HTTPException(status_code=404, detail="Logo not found")
    return Response(content=agency.logo_data, media_type=agency.logo_mime, headers={"Cache-Control": "no-store"})


@router.post("/{slug}/login", response_model=PortalSessionOut, dependencies=[Depends(login_rate_limit)])
def portal_login(slug: str, payload: PortalLoginRequest, response: Response, db: Session = Depends(get_db)):
    client = _public_client(db, slug)
    if (
        not client.portal_email
        or payload.email.lower() != client.portal_email.lower()
        or not client.portal_password_hash
        or not verify_password(payload.password, client.portal_password_hash)
    ):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    settings = get_settings()
    response.set_cookie(
        key="portal_access_token",
        value=create_portal_token(str(client.id), client.portal_slug),
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_minutes * 60,
        path="/",
    )
    agency = db.get(Agency, client.agency_id)
    return {"client_id": client.id, "client_name": client.name, "portal_slug": client.portal_slug, "agency_name": agency.name}


@router.post("/{slug}/logout", status_code=status.HTTP_204_NO_CONTENT)
def portal_logout(response: Response):
    response.delete_cookie("portal_access_token", path="/")


@router.get("/{slug}/me", response_model=PortalSessionOut)
def portal_me(slug: str, client: Client = Depends(_portal_client), db: Session = Depends(get_db)):
    agency = db.get(Agency, client.agency_id)
    return {"client_id": client.id, "client_name": client.name, "portal_slug": client.portal_slug, "agency_name": agency.name}


@router.get("/{slug}/agents", response_model=list[AgentSummary])
def portal_agents(slug: str, client: Client = Depends(_portal_client), db: Session = Depends(get_db)):
    return db.scalars(select(Agent).where(Agent.client_id == client.id).order_by(Agent.name)).all()


@router.get("/{slug}/conversations", response_model=list[ConversationOut])
def portal_conversations(slug: str, client: Client = Depends(_portal_client), db: Session = Depends(get_db)):
    ranked = select(
        Message.conversation_id.label("cid"),
        Message.content.label("content"),
        func.row_number().over(partition_by=Message.conversation_id, order_by=Message.created_at.desc()).label("rn"),
    ).subquery()
    last = select(ranked).where(ranked.c.rn == 1).subquery()
    rows = db.execute(
        select(Conversation, last.c.content)
        .outerjoin(last, last.c.cid == Conversation.id)
        .where(Conversation.client_id == client.id)
        .order_by(Conversation.updated_at.desc())
    ).all()
    return [
        ConversationOut.model_validate(conv).model_copy(update={"preview": (content or "")[:140].strip()})
        for conv, content in rows
    ]


@router.get("/{slug}/conversations/{conversation_id}", response_model=ConversationDetail)
def portal_conversation(slug: str, conversation_id: uuid.UUID, client: Client = Depends(_portal_client), db: Session = Depends(get_db)):
    return _visible_detail(db, client, conversation_id)


@router.patch("/{slug}/conversations/{conversation_id}/mode", response_model=ConversationDetail)
def portal_mode(
    slug: str,
    conversation_id: uuid.UUID,
    payload: ConversationModeUpdate,
    client: Client = Depends(_portal_client),
    db: Session = Depends(get_db),
):
    conversation = _detail(db, client, conversation_id)
    conversation.mode = payload.mode
    conversation.updated_at = now_utc()
    db.commit()
    return _visible_detail(db, client, conversation_id)


@router.post("/{slug}/conversations/{conversation_id}/reply", response_model=ConversationDetail)
def portal_reply(
    slug: str,
    conversation_id: uuid.UUID,
    payload: HumanReplyRequest,
    client: Client = Depends(_portal_client),
    db: Session = Depends(get_db),
):
    asyncio.run(deliver_human(db, client, conversation_id, payload.request_id, payload.content))
    return _visible_detail(db, client, conversation_id)
