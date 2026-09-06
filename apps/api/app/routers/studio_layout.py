"""Client canvas presentation only; never changes bindings or execution."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, Client, User

router = APIRouter(prefix="/studio/{client_id}/layout", tags=["Studio canvas layout"])


class Point(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: int = Field(ge=0, le=4096, strict=True)
    y: int = Field(ge=70, le=32768, strict=True)


class Layout(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_revision: int = Field(ge=0, strict=True)
    positions: dict[str, Point] = Field(default_factory=dict, max_length=200)
    zoom: int = Field(default=100, ge=75, le=150, multiple_of=25, strict=True)


def node_ids(agent_ids):
    return {*(f'channel:{kind}' for kind in ('whatsapp', 'whatsapp-cloud', 'instagram', 'messenger')),
            *(f'{kind}:{agent}' for agent in agent_ids for kind in ('agent', 'widget'))}


def layout_view(client, agent_ids):
    stored = client.studio_layout or {}
    allowed = node_ids(agent_ids)
    return {"revision": stored.get('revision', 0), "zoom": stored.get('zoom', 100),
            "positions": {k: v for k, v in stored.get('positions', {}).items() if k in allowed}}


def context(db, user, client_id, lock=False):
    query = select(Client).where(Client.id == client_id, Client.agency_id == user.agency_id)
    try:
        client = db.scalar(query.execution_options(populate_existing=True).with_for_update(nowait=True) if lock else query)
    except OperationalError as exc:
        if getattr(exc.orig, 'sqlstate', None) == '55P03': raise HTTPException(409, 'Layout busy; reload') from exc
        raise
    if not client: raise HTTPException(404, 'Client not found')
    ids = db.scalars(select(Agent.id).where(Agent.client_id == client_id, Agent.agency_id == user.agency_id)).all()
    return client, ids


@router.get('')
def read(client_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return layout_view(*context(db, user, client_id))


@router.put('')
def save(client_id: uuid.UUID, payload: Layout, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    principal = (user.agency_id, user.session_version)
    client, ids = context(db, user, client_id, lock=True)
    db.refresh(user)
    if user.role != 'admin' or (user.agency_id, user.session_version) != principal or not user.agency.is_active:
        raise HTTPException(403, 'Administrative session changed')
    current = layout_view(client, ids)
    if current['revision'] != payload.expected_revision: raise HTTPException(409, 'Layout changed; reload before saving')
    if not set(payload.positions) <= node_ids(ids): raise HTTPException(422, 'Layout contains unavailable nodes')
    client.studio_layout = {**payload.model_dump(exclude={'expected_revision'}), 'revision': current['revision'] + 1}
    db.commit()
    return layout_view(client, ids)
