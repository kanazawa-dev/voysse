"""Per-user product tour progress; completion never implies production readiness."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_inbox_user
from ..models import User

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])


class Progress(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step: int = Field(default=0, ge=0, le=7, strict=True)
    status: Literal["new", "in_progress", "completed"] = "new"
    revision: int = Field(default=0, ge=0, strict=True)


class Update(BaseModel):
    model_config = ConfigDict(extra="forbid")
    step: int = Field(ge=0, le=7, strict=True)
    status: Literal["in_progress", "completed"]
    expected_revision: int = Field(ge=0, strict=True)


@router.get("", response_model=Progress)
def read(user: User = Depends(get_inbox_user)):
    return Progress.model_validate(user.onboarding_state or {})


@router.put("", response_model=Progress)
def save(payload: Update, db: Session = Depends(get_db), user: User = Depends(get_inbox_user)):
    principal = (user.agency_id, user.session_version, user.role)
    row = db.scalar(select(User).where(User.id == user.id, User.agency_id == user.agency_id)
                    .execution_options(populate_existing=True).with_for_update())
    if not row or (row.agency_id, row.session_version, row.role) != principal:
        raise HTTPException(403, "Session changed")
    db.refresh(row.agency)
    if not row.agency.is_active:
        raise HTTPException(403, "Agency inactive")
    current = Progress.model_validate(row.onboarding_state or {})
    if payload.expected_revision != current.revision:
        raise HTTPException(409, "Tour changed in another tab; reload to continue")
    last = 7 if row.role == "admin" else 2
    if payload.step > last or (payload.status == "completed" and payload.step != last):
        raise HTTPException(422, "Invalid tour step")
    result = Progress(step=payload.step, status=payload.status, revision=current.revision + 1)
    row.onboarding_state = result.model_dump()
    db.commit()
    return result
