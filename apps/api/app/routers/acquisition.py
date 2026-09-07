"""First-party aggregate campaign counters, never visitor profiles."""
from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin
from ..models import AcquisitionCount, AdminUser, now_utc
from ..ratelimit import RateLimiter

router = APIRouter(tags=["Acquisition"])
acquisition_limit = RateLimiter(30, 60, name="acquisition")


class AcquisitionEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9._-]*$")
    event: Literal["pageview", "app", "docs", "github", "booking"]

    @field_validator("source", mode="before")
    @classmethod
    def normalize(cls, value):
        return value.strip().lower() if isinstance(value, str) else value


@router.post("/acquisition/events", status_code=204, dependencies=[Depends(acquisition_limit)])
def collect(payload: AcquisitionEvent, db: Session = Depends(get_db)):
    today = now_utc().date()
    # Bounded opportunistic retention cleanup; reports also exclude old counters.
    expired = select(AcquisitionCount.day, AcquisitionCount.source, AcquisitionCount.event).where(
        AcquisitionCount.day < today - timedelta(days=89)
    ).limit(200).with_for_update(skip_locked=True)
    for day, source, event in db.execute(expired):
        db.execute(delete(AcquisitionCount).where(
            AcquisitionCount.day == day, AcquisitionCount.source == source, AcquisitionCount.event == event))
    statement = insert(AcquisitionCount).values(day=today, source=payload.source, event=payload.event, count=1)
    db.execute(statement.on_conflict_do_update(
        index_elements=["day", "source", "event"],
        set_={"count": AcquisitionCount.count + 1},
    ))
    db.commit()
    return Response(status_code=204)


@router.get("/admin/acquisition")
def report(days: int = Query(30, ge=1, le=90), db: Session = Depends(get_db),
           admin: AdminUser = Depends(get_current_admin)):
    total = func.sum(AcquisitionCount.count).label("count")
    rows = db.execute(select(AcquisitionCount.source, AcquisitionCount.event, total)
        .where(AcquisitionCount.day >= now_utc().date() - timedelta(days=days - 1))
        .group_by(AcquisitionCount.source, AcquisitionCount.event)
        .order_by(total.desc(), AcquisitionCount.source, AcquisitionCount.event).limit(1001)).all()
    return {"days": days, "truncated": len(rows) > 1000,
            "rows": [{"source": r.source, "event": r.event, "count": r.count} for r in rows[:1000]]}
