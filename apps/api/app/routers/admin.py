import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..deps import get_current_admin
from ..models import AdminUser, Agency, Client, CloudLead
from ..ratelimit import admin_login_rate_limit
from ..schemas import (
    AdminLoginRequest,
    AdminOut,
    AgencyAdminOut,
    AgencyStatusUpdate,
    CloudLeadOut,
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


@router.get("/leads", response_model=list[CloudLeadOut])
def list_leads(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return db.scalars(select(CloudLead).order_by(CloudLead.created_at.desc())).all()


@router.get("/agencies", response_model=list[AgencyAdminOut])
def list_agencies(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    agencies = db.scalars(select(Agency).order_by(Agency.created_at.desc())).all()
    out = []
    for agency in agencies:
        owner = min(agency.users, key=lambda u: u.created_at, default=None)
        client_count = db.scalar(select(func.count()).select_from(Client).where(Client.agency_id == agency.id)) or 0
        out.append(AgencyAdminOut(
            id=agency.id,
            name=agency.name,
            slug=agency.slug,
            is_active=agency.is_active,
            created_at=agency.created_at,
            owner_email=owner.email if owner else None,
            user_count=len(agency.users),
            client_count=client_count,
        ))
    return out


@router.patch("/agencies/{agency_id}", response_model=AgencyAdminOut)
def update_agency_status(agency_id: uuid.UUID, payload: AgencyStatusUpdate, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    agency = db.get(Agency, agency_id)
    if not agency:
        raise HTTPException(status_code=404, detail="Agency not found")
    agency.is_active = payload.is_active
    db.commit()
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
