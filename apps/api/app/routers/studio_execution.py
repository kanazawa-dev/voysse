"""Administrative inspection/quarantine; does not start or retry execution."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Conversation, ConversationRuntime, ExecutionTurn, User, now_utc
from ..services.execution_state import locked, owned_turn
from .studio_handoffs import _client

router = APIRouter(prefix="/studio/{client_id}/execution", tags=["Studio execution review"])


class Review(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    request_id: uuid.UUID
    expected_revision: int = Field(ge=0, strict=True)
    reason: str = Field(min_length=1, max_length=500)
    acknowledge_external_effects: Literal[True]


@router.get("")
def inspect(client_id: uuid.UUID, limit: int = Query(25, ge=1, le=50),
            offset: int = Query(0, ge=0, le=10000), db: Session = Depends(get_db),
            user: User = Depends(get_current_user)):
    _client(db, user, client_id)
    # One statement gives a coherent turn/runtime snapshot, without message content.
    rows = db.execute(select(ExecutionTurn, ConversationRuntime).join(Conversation,
        Conversation.id == ExecutionTurn.conversation_id).join(ConversationRuntime,
        ConversationRuntime.conversation_id == Conversation.id).where(
        Conversation.client_id == client_id, Conversation.agency_id == user.agency_id)
        .order_by(ExecutionTurn.created_at.desc(), ExecutionTurn.id.desc()).offset(offset).limit(limit + 1)).all()
    return {"runtime_enabled": True, "has_more": len(rows) > limit, "items": [
        {"turn_id": turn.id, "conversation_id": turn.conversation_id, "status": turn.status,
         "policy_revision_id": turn.policy_revision_id,
         "created_at": turn.created_at, "updated_at": turn.updated_at,
         "transitions": turn.transitions, "current_revision": runtime.revision,
         "current_responder_id": runtime.responder_id, "active_turn_id": runtime.active_turn_id}
        for turn, runtime in rows[:limit]]}


@router.post("/{conversation_id}/{turn_id}/review-human")
def review(client_id: uuid.UUID, conversation_id: uuid.UUID, turn_id: uuid.UUID,
           payload: Review, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    agency_id, actor_id, session_version = user.agency_id, user.id, user.session_version
    conversation, runtime = locked(db, agency_id, conversation_id)
    if conversation.client_id != client_id:
        raise HTTPException(404, "Conversation not found")
    actor = db.get(User, actor_id, populate_existing=True)
    if not actor or actor.role != "admin" or actor.agency_id != agency_id or actor.session_version != session_version:
        raise HTTPException(403, "Administrative session changed")
    turn = owned_turn(db, runtime, turn_id)
    identity = {"id": str(payload.request_id), "kind": "human_review", "actor_id": str(actor_id),
                "reason": payload.reason, "expected_revision": payload.expected_revision,
                "target_id": None, "acknowledge_external_effects": True}
    for entry in turn.transitions:
        if entry["id"] == identity["id"]:
            if any(entry.get(key) != value for key, value in identity.items()):
                raise HTTPException(409, "Review key reused with different input")
            return {"review": entry, "applied": False}
    if runtime.active_turn_id != turn_id or runtime.revision != payload.expected_revision or turn.status not in {"running", "uncertain"}:
        raise HTTPException(409, "Execution owner changed or turn already closed")
    entry = {**identity, "previous_status": turn.status, "reviewed_at": now_utc().isoformat(),
             "source_id": str(runtime.responder_id) if runtime.responder_id else None,
             "revision": runtime.revision + 1}
    turn.transitions = [*turn.transitions, entry]
    turn.status = "reviewed_human"
    runtime.revision += 1
    runtime.active_turn_id, runtime.responder_id = None, None
    conversation.mode = "human"
    db.commit()
    return {"review": entry, "applied": True}
