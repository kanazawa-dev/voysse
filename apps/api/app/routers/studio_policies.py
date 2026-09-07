"""Publish configuration snapshots only. No live adapter consumes this journal."""
import uuid
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_current_user
from ..models import Agency, Agent, Client, PolicyRevision, User
from .studio_handoffs import Draft, _client, problems

router = APIRouter(prefix="/studio/{client_id}/policies", tags=["Studio published policies"])


class Publish(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    request_id: uuid.UUID
    action: Literal["publish", "restore", "unpublish"]
    expected_revision: int = Field(ge=0, strict=True)
    draft_revision: int | None = Field(default=None, ge=0, strict=True)
    restore_revision: int | None = Field(default=None, ge=1, strict=True)
    reason: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def inputs(self):
        if (self.draft_revision is not None) != (self.action == "publish") or (self.restore_revision is not None) != (self.action == "restore"):
            raise ValueError("Supply draft_revision only for publish, restore_revision only for restore")
        return self


def encoded(row):
    return {"id": row.id, "revision": row.revision, "actor_id": row.actor_id,
            "request": row.request, "policy": row.policy, "created_at": row.created_at}


@router.get("")
def history(client_id: uuid.UUID, limit: int = Query(10, ge=1, le=50),
            before_revision: int | None = Query(None, ge=1), db: Session = Depends(get_db),
            user: User = Depends(get_current_user)):
    _client(db, user, client_id)
    query = select(PolicyRevision).where(PolicyRevision.client_id == client_id)
    if before_revision is not None: query = query.where(PolicyRevision.revision < before_revision)
    rows = db.scalars(query.order_by(PolicyRevision.revision.desc()).limit(limit + 1)).all()
    return {"runtime_enabled": True, "items": [encoded(row) for row in rows[:limit]], "has_more": len(rows) > limit}


def lock(db, query):
    try:
        return db.scalars(query.execution_options(populate_existing=True).with_for_update(nowait=True)).all()
    except OperationalError as exc:
        if getattr(exc.orig, "sqlstate", None) == "55P03":
            raise HTTPException(409, "Policy resources busy; reload") from exc
        raise


@router.post("")
def publish(client_id: uuid.UUID, payload: Publish, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    actor_id, agency_id, session_version = user.id, user.agency_id, user.session_version
    agencies = lock(db, select(Agency).where(Agency.id == agency_id))
    actors = lock(db, select(User).where(User.id == actor_id))
    if not agencies or not agencies[0].is_active or not actors or actors[0].agency_id != agency_id or actors[0].role != "admin" or actors[0].session_version != session_version:
        raise HTTPException(403, "Administrative session changed")
    clients = lock(db, select(Client).where(Client.id == client_id, Client.agency_id == agency_id))
    if not clients: raise HTTPException(404, "Client not found")
    client = clients[0]
    identity = payload.model_dump(mode="json", exclude={"request_id"})
    existing = db.get(PolicyRevision, payload.request_id)
    if existing:
        if existing.client_id != client_id or existing.actor_id != actor_id or existing.request != identity:
            raise HTTPException(409, "Publication key reused with different input")
        return {"runtime_enabled": True, "applied": False, "version": encoded(existing)}
    latest = db.scalar(select(PolicyRevision).where(PolicyRevision.client_id == client_id).order_by(PolicyRevision.revision.desc()).limit(1))
    if (latest.revision if latest else 0) != payload.expected_revision:
        raise HTTPException(409, "Published policy changed; reload")
    policy = None
    if payload.action != "unpublish":
        if not client.is_active: raise HTTPException(409, "Client inactive")
        if payload.action == "publish":
            stored = dict(client.handoff_draft or {})
            if stored.pop("revision", 0) != payload.draft_revision:
                raise HTTPException(409, "Draft changed; reload")
            draft = Draft.model_validate(stored)
        else:
            old = db.scalar(select(PolicyRevision).where(PolicyRevision.client_id == client_id, PolicyRevision.revision == payload.restore_revision))
            if not old or old.policy is None: raise HTTPException(404, "Published snapshot not found")
            draft = Draft.model_validate(old.policy)
        ids = {r.source_agent_id for r in draft.rules} | {r.target_agent_id for r in draft.rules if r.target_agent_id}
        lock(db, select(Agent).where(Agent.id.in_(ids), Agent.client_id == client_id, Agent.agency_id == agency_id).order_by(Agent.id))
        if problems(db, actors[0], client, draft): raise HTTPException(422, "Policy references invalid agents or rules")
        policy = draft.model_dump(mode="json")
    row = PolicyRevision(id=payload.request_id, client_id=client_id, revision=payload.expected_revision + 1,
                         actor_id=actor_id, request=identity, policy=policy)
    db.add(row)
    try: db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Publication key or revision already used") from exc
    return {"runtime_enabled": True, "applied": True, "version": encoded(row)}
