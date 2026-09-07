"""Draft configuration only. Never change channel or conversation ownership."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Client, User
from ..services.handoffs import Draft, Rule, problems

router = APIRouter(prefix="/studio/{client_id}/handoffs", tags=["Studio handoff drafts"])

__all__ = ["Rule", "Draft", "SaveDraft", "problems", "view", "router"]


class SaveDraft(Draft):
    expected_revision: int = Field(ge=0, strict=True)


def _client(db, user, client_id, lock=False):
    query = select(Client).where(Client.id == client_id, Client.agency_id == user.agency_id)
    row = db.scalar(query.with_for_update() if lock else query)
    if not row:
        raise HTTPException(404, "Client not found")
    return row


def view(db, user, client):
    stored = dict(client.handoff_draft or {})
    revision = stored.pop("revision", 0)
    draft = Draft.model_validate(stored)
    errors = problems(db, user.agency_id, client, draft)
    return {**draft.model_dump(mode="json"), "revision": revision, "state": "draft",
            "runtime_enabled": True, "valid": not errors, "problems": errors}


@router.get("")
def read(client_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return view(db, user, _client(db, user, client_id))


@router.put("")
def save(client_id: uuid.UUID, payload: SaveDraft, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    client = _client(db, user, client_id, lock=True)
    revision = (client.handoff_draft or {}).get("revision", 0)
    if revision != payload.expected_revision:
        raise HTTPException(409, "Draft changed; reload before saving")
    errors = problems(db, user.agency_id, client, payload)
    if errors:
        raise HTTPException(422, "Invalid handoff draft: " + ", ".join(errors))
    # Whole-document replacement plus row lock makes draft edits atomic. No publish flag.
    client.handoff_draft = {**payload.model_dump(mode="json", exclude={"expected_revision"}),
                            "revision": revision + 1}
    db.commit()
    return view(db, user, client)
