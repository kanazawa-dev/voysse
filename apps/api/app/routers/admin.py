import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_admin
from ..models import (
    Agent,
    AdminUser,
    Agency,
    Client,
    CloudLead,
    Conversation,
    Message,
    User,
    WhatsAppChannel,
    WhatsAppCloudChannel,
    now_utc,
)
from ..ratelimit import admin_login_rate_limit
from ..schemas import (
    AdminLoginRequest,
    AdminOut,
    AdminStatsOut,
    AgencyAdminOut,
    AgencyClientSummary,
    AgencyDetailOut,
    AgencyStatusUpdate,
    AgencyUserSummary,
    CloudLeadOut,
    CloudLeadUpdate,
)
from ..security import create_admin_token, verify_password


router = APIRouter(prefix="/admin", tags=["Admin"])


def _set_admin_cookie(response: Response, admin: AdminUser) -> None:
    settings = get_settings()
    response.set_cookie(
        key="admin_access_token",
        value=create_admin_token(str(admin.id)),
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_minutes * 60,
        path="/",
    )


@router.post("/auth/login", response_model=AdminOut, dependencies=[Depends(admin_login_rate_limit)])
def admin_login(payload: AdminLoginRequest, response: Response, db: Session = Depends(get_db)):
    admin = db.scalar(select(AdminUser).where(AdminUser.email == payload.email.lower()))
    if not admin or not verify_password(payload.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    _set_admin_cookie(response, admin)
    return admin


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
def admin_logout(response: Response):
    response.delete_cookie("admin_access_token", path="/")


@router.get("/auth/me", response_model=AdminOut)
def admin_me(admin: AdminUser = Depends(get_current_admin)):
    return admin


def _agency_admin_out(db: Session, agency: Agency) -> AgencyAdminOut:
    owner = min(agency.users, key=lambda u: u.created_at, default=None)
    client_count = db.scalar(select(func.count()).select_from(Client).where(Client.agency_id == agency.id)) or 0
    return AgencyAdminOut(
        id=agency.id,
        name=agency.name,
        slug=agency.slug,
        is_active=agency.is_active,
        created_at=agency.created_at,
        owner_email=owner.email if owner else None,
        user_count=len(agency.users),
        client_count=client_count,
    )


@router.get("/stats", response_model=AdminStatsOut)
def admin_stats(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    since_7d = now_utc() - timedelta(days=7)
    return AdminStatsOut(
        agencies_total=db.scalar(select(func.count(Agency.id))) or 0,
        agencies_active=db.scalar(select(func.count(Agency.id)).where(Agency.is_active.is_(True))) or 0,
        clients_total=db.scalar(select(func.count(Client.id))) or 0,
        agents_total=db.scalar(select(func.count(Agent.id))) or 0,
        agents_active=db.scalar(select(func.count(Agent.id)).where(Agent.is_active.is_(True))) or 0,
        whatsapp_connected=(
            (db.scalar(select(func.count(WhatsAppChannel.id)).where(WhatsAppChannel.status == "connected")) or 0)
            + (db.scalar(select(func.count(WhatsAppCloudChannel.id)).where(WhatsAppCloudChannel.status == "connected")) or 0)
        ),
        whatsapp_total=(
            (db.scalar(select(func.count(WhatsAppChannel.id))) or 0)
            + (db.scalar(select(func.count(WhatsAppCloudChannel.id))) or 0)
        ),
        messages_total=db.scalar(select(func.count(Message.id))) or 0,
        messages_7d=db.scalar(select(func.count(Message.id)).where(Message.created_at >= since_7d)) or 0,
        leads_total=db.scalar(select(func.count(CloudLead.id))) or 0,
        leads_new=db.scalar(select(func.count(CloudLead.id)).where(CloudLead.status == "new")) or 0,
    )


@router.get("/leads", response_model=list[CloudLeadOut])
def list_leads(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return db.scalars(select(CloudLead).order_by(CloudLead.created_at.desc())).all()


@router.patch("/leads/{lead_id}", response_model=CloudLeadOut)
def update_lead(lead_id: uuid.UUID, payload: CloudLeadUpdate, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    lead = db.get(CloudLead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if payload.status is not None:
        if payload.status not in {"new", "contacted", "dismissed"}:
            raise HTTPException(status_code=422, detail="Invalid status")
        lead.status = payload.status
    if payload.notes is not None:
        lead.notes = payload.notes
    db.commit()
    return lead


@router.get("/agencies", response_model=list[AgencyAdminOut])
def list_agencies(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    agencies = db.scalars(select(Agency).order_by(Agency.created_at.desc())).all()
    return [_agency_admin_out(db, agency) for agency in agencies]


@router.get("/agencies/{agency_id}", response_model=AgencyDetailOut)
def get_agency(agency_id: uuid.UUID, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    agency = db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    base = _agency_admin_out(db, agency)

    users = db.scalars(select(User).where(User.agency_id == agency_id).order_by(User.created_at)).all()
    clients = db.scalars(select(Client).where(Client.agency_id == agency_id).order_by(Client.created_at.desc())).all()
    messages_total = db.scalar(
        select(func.count(Message.id))
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Conversation.agency_id == agency_id)
    ) or 0

    client_rows = []
    for client in clients:
        agent_count = db.scalar(select(func.count(Agent.id)).where(Agent.client_id == client.id)) or 0
        whatsapp_status = None
        if client.whatsapp_channel:
            whatsapp_status = client.whatsapp_channel.status
        elif client.whatsapp_cloud_channel:
            whatsapp_status = client.whatsapp_cloud_channel.status
        client_rows.append(AgencyClientSummary(
            id=client.id,
            name=client.name,
            is_active=client.is_active,
            agent_count=agent_count,
            whatsapp_status=whatsapp_status,
            created_at=client.created_at,
        ))

    return AgencyDetailOut(
        **base.model_dump(),
        messages_total=messages_total,
        users=[AgencyUserSummary.model_validate(u) for u in users],
        clients=client_rows,
    )


@router.patch("/agencies/{agency_id}", response_model=AgencyAdminOut)
def update_agency_status(agency_id: uuid.UUID, payload: AgencyStatusUpdate, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    agency = db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    agency.is_active = payload.is_active
    db.commit()
    return _agency_admin_out(db, agency)
