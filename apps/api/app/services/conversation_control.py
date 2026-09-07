"""Legacy mode controls must not bypass Studio's durable execution owner."""
from fastapi import HTTPException
from sqlalchemy.exc import OperationalError

from ..models import Conversation, ConversationRuntime, now_utc


def set_mode(db, conversation, mode):
    # Scope/authentication belongs to the calling route. Serialize with claims,
    # settlement and human delivery; never wait behind external network work.
    try:
        db.refresh(conversation, with_for_update={"of": Conversation, "nowait": True})
    except OperationalError as exc:
        if getattr(exc.orig, "sqlstate", None) == "55P03":
            raise HTTPException(409, "Conversation is busy; reload before changing control") from exc
        raise
    runtime = db.get(ConversationRuntime, conversation.id, populate_existing=True)
    if mode == "ai" and runtime is not None:
        # Even a completed/reviewed turn retains its responder and revision.
        # A legacy toggle cannot reset that identity or recover uncertain effects.
        raise HTTPException(409, "Studio execution requires audited AI resume; legacy mode changes cannot resume it")
    conversation.mode = mode
    conversation.updated_at = now_utc()
    # Taking human control only fences late commits. Keep the claim/journal intact
    # for explicit review; do not imply cancellation of already-started effects.
