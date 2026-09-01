"""Raise and resolve agency-facing Alerts.

Alerts exist for things that go wrong on their own, outside of a user action
they're already watching the result of (a synchronous "connect" click already
surfaces its own failure in the UI). Call raise_alert at the point something
breaks async, and resolve_alerts when that same resource recovers.

Callers still own the db.commit() -- these helpers only stage changes.
"""

import uuid

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from .models import Alert, now_utc


def raise_alert(
    db: Session,
    agency_id: uuid.UUID,
    type: str,
    severity: str,
    title: str,
    message: str = "",
    resource_type: str | None = None,
    resource_id: uuid.UUID | None = None,
) -> Alert:
    existing = db.scalar(
        select(Alert).where(
            Alert.agency_id == agency_id,
            Alert.type == type,
            Alert.resource_id == resource_id,
            Alert.resolved_at.is_(None),
        )
    )
    if existing:
        existing.title = title
        existing.message = message
        existing.created_at = now_utc()
        return existing
    alert = Alert(
        agency_id=agency_id,
        type=type,
        severity=severity,
        title=title,
        message=message,
        resource_type=resource_type,
        resource_id=resource_id,
    )
    db.add(alert)
    return alert


def resolve_alerts(db: Session, agency_id: uuid.UUID, type: str, resource_id: uuid.UUID | None) -> None:
    db.execute(
        update(Alert)
        .where(
            Alert.agency_id == agency_id,
            Alert.type == type,
            Alert.resource_id == resource_id,
            Alert.resolved_at.is_(None),
        )
        .values(resolved_at=now_utc())
    )
