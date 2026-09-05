import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agency, TeamInvitation, User
from ..ratelimit import login_rate_limit
from ..schemas import AgencyUserSummary
from ..security import hash_password
from ..services.password_recovery import token_digest
from .auth import ResetPasswordRequest

router = APIRouter(prefix="/team", tags=["Team"])


class InvitationRequest(BaseModel):
    email: EmailStr
    role: Literal["admin", "operator"] = "operator"


class AcceptInvitation(ResetPasswordRequest):
    name: str = Field(min_length=2, max_length=160)


class RoleRequest(BaseModel):
    role: Literal["admin", "operator"]


def lock_agency(db: Session, agency_id: uuid.UUID):
    return db.scalar(select(Agency).where(Agency.id == agency_id).with_for_update())


def lock_admin(db: Session, user: User):
    agency = lock_agency(db, user.agency_id)
    # An administrator may have been demoted/removed while waiting on the lock.
    current = db.scalar(select(User).where(User.id == user.id)
                        .execution_options(populate_existing=True).with_for_update())
    if not agency.is_active or not current or current.role != "admin":
        raise HTTPException(status_code=403, detail="Administrator access required")


@router.get("/members", response_model=list[AgencyUserSummary])
def members(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(User).where(User.agency_id == user.agency_id).order_by(User.created_at)).all()


@router.get("/invitations")
def invitations(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [{"id": row.id, "email": row.email, "role": row.role, "expires_at": row.expires_at}
            for row in db.scalars(select(TeamInvitation).where(
                TeamInvitation.agency_id == user.agency_id,
                TeamInvitation.expires_at > datetime.now(timezone.utc),
            ))]


@router.post("/invitations", status_code=201, dependencies=[Depends(login_rate_limit)])
def invite(payload: InvitationRequest, response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lock_admin(db, user)
    email = payload.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Email already registered")
    # Reissuing for this email revokes the older link.
    db.execute(delete(TeamInvitation).where(
        TeamInvitation.agency_id == user.agency_id, TeamInvitation.email == email,
    ))
    token = secrets.token_urlsafe(32)
    invitation = TeamInvitation(
        agency_id=user.agency_id, email=email, role=payload.role,
        token_hash=token_digest(token), expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
    )
    db.add(invitation)
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return {"id": invitation.id, "token": token, "expires_at": invitation.expires_at}


@router.delete("/invitations/{invitation_id}", status_code=204)
def revoke(invitation_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lock_admin(db, user)
    db.execute(delete(TeamInvitation).where(
        TeamInvitation.id == invitation_id, TeamInvitation.agency_id == user.agency_id,
    ))
    db.commit()


@router.post("/accept", status_code=204, dependencies=[Depends(login_rate_limit)])
def accept(payload: AcceptInvitation, response: Response, db: Session = Depends(get_db)):
    # Lock the agency first (same order as admin writes), then re-read invitation.
    invitation = db.scalar(select(TeamInvitation).where(TeamInvitation.token_hash == token_digest(payload.token)))
    if not invitation:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")
    agency = lock_agency(db, invitation.agency_id)
    invitation = db.scalar(select(TeamInvitation).where(
        TeamInvitation.token_hash == token_digest(payload.token)
    ).execution_options(populate_existing=True).with_for_update())
    if not invitation or not agency or not agency.is_active or invitation.expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired invitation")
    db.add(User(agency_id=agency.id, email=invitation.email, role=invitation.role,
                name=payload.name.strip(), password_hash=hash_password(payload.password)))
    db.delete(invitation)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    response.headers["Cache-Control"] = "no-store"
    # No automatic login or account switching; explicitly sign in with new credentials.


@router.patch("/members/{member_id}", response_model=AgencyUserSummary)
def change_role(member_id: uuid.UUID, payload: RoleRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lock_admin(db, user)
    if member_id == user.id:
        raise HTTPException(status_code=409, detail="You cannot change your own role")
    member = db.scalar(select(User).where(User.id == member_id, User.agency_id == user.agency_id).with_for_update())
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.role = payload.role
    member.session_version += 1
    db.commit()
    return member


@router.delete("/members/{member_id}", status_code=204)
def remove_member(member_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    lock_admin(db, user)
    if member_id == user.id:
        raise HTTPException(status_code=409, detail="You cannot remove yourself")
    member = db.scalar(select(User).where(User.id == member_id, User.agency_id == user.agency_id).with_for_update())
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
