import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Alert, User, now_utc
from ..schemas import AlertOut

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(resolved: bool = False, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = select(Alert).where(Alert.agency_id == user.agency_id)
    query = query.where(Alert.resolved_at.is_not(None)) if resolved else query.where(Alert.resolved_at.is_(None))
    return db.scalars(query.order_by(Alert.created_at.desc()).limit(100)).all()


@router.post("/{alert_id}/resolve", response_model=AlertOut)
def resolve_alert(alert_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    alert = db.get(Alert, alert_id)
    if not alert or alert.agency_id != user.agency_id:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.resolved_at = now_utc()
    db.commit()
    return alert
