"""Draft configuration only. Never change channel or conversation ownership."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, Client, User

router = APIRouter(prefix="/studio/{client_id}/handoffs", tags=["Studio handoff drafts"])


class Rule(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    source_agent_id: uuid.UUID
    target_agent_id: uuid.UUID | None  # None explicitly requests human attention.
    condition: str = Field(min_length=1, max_length=1000)


class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rules: list[Rule] = Field(default_factory=list, max_length=32)
    max_hops: int = Field(default=3, ge=1, le=5, strict=True)
    human_fallback: Literal[True] = True


class SaveDraft(Draft):
    expected_revision: int = Field(ge=0, strict=True)


def _client(db, user, client_id, lock=False):
    query = select(Client).where(Client.id == client_id, Client.agency_id == user.agency_id)
    row = db.scalar(query.with_for_update() if lock else query)
    if not row:
        raise HTTPException(404, "Client not found")
    return row


def problems(db, user, client, draft):
    allowed = set(db.scalars(select(Agent.id).where(Agent.client_id == client.id,
        Agent.agency_id == user.agency_id, Agent.is_active.is_(True))).all())
    edges, seen = {}, set()
    for rule in draft.rules:
        source, target = rule.source_agent_id, rule.target_agent_id
        if source not in allowed or (target is not None and target not in allowed):
            return ["unavailable_agent"]
        if source == target:
            return ["self_reference"]
        if (source, target) in seen:
            return ["duplicate_connection"]
        seen.add((source, target))
        if target is not None:
            edges.setdefault(source, []).append(target)
    visiting, visited = set(), set()
    def cycle(node):
        if node in visiting:
            return True
        if node in visited:
            return False
        visiting.add(node)
        if any(cycle(target) for target in edges.get(node, [])):
            return True
        visiting.remove(node)
        visited.add(node)
        return False
    return ["cycle"] if any(cycle(source) for source in edges) else []


def view(db, user, client):
    stored = dict(client.handoff_draft or {})
    revision = stored.pop("revision", 0)
    draft = Draft.model_validate(stored)
    errors = problems(db, user, client, draft)
    return {**draft.model_dump(mode="json"), "revision": revision, "state": "draft",
            "runtime_enabled": False, "valid": not errors, "problems": errors}


@router.get("")
def read(client_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return view(db, user, _client(db, user, client_id))


@router.put("")
def save(client_id: uuid.UUID, payload: SaveDraft, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    client = _client(db, user, client_id, lock=True)
    revision = (client.handoff_draft or {}).get("revision", 0)
    if revision != payload.expected_revision:
        raise HTTPException(409, "Draft changed; reload before saving")
    errors = problems(db, user, client, payload)
    if errors:
        raise HTTPException(422, "Invalid handoff draft: " + ", ".join(errors))
    # Whole-document replacement plus row lock makes draft edits atomic. No publish flag.
    client.handoff_draft = {**payload.model_dump(mode="json", exclude={"expected_revision"}),
                            "revision": revision + 1}
    db.commit()
    return view(db, user, client)
