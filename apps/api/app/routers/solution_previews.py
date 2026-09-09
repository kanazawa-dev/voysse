"""Read-only installation previews and explicit add-only override protection."""
import uuid
from dataclasses import asdict
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, SolutionInstallation, User
from ..services.solution_personalizations import override_fields, shared_settings
from ..services.solution_updates import SolutionSettings, plan_update
from .solutions import InstallationOut, Request, _version

router = APIRouter(prefix="/solutions", tags=["Solutions"])
Setting = Literal["instructions", "personality", "temperature", "max_tokens", "memory_limit"]


class ProtectField(Request):
    field: Setting
    expected_revision: int = Field(ge=1, strict=True)
    expected_agent_updated_at: datetime


def locked_installation(db, user, solution_id, installation_id):
    query = select(SolutionInstallation).where(SolutionInstallation.id == installation_id,
        SolutionInstallation.solution_id == solution_id, SolutionInstallation.agency_id == user.agency_id)
    installation = db.scalar(query)
    if installation is None:
        raise HTTPException(404, "Installation not found")
    agent = db.scalar(select(Agent).where(Agent.id == installation.agent_id,
        Agent.agency_id == user.agency_id, Agent.client_id == installation.client_id)
        .with_for_update().execution_options(populate_existing=True))
    installation = db.scalar(query.with_for_update().execution_options(populate_existing=True))
    if agent is None or installation is None:
        raise HTTPException(404, "Installation not found")
    return installation, agent


@router.get("/{solution_id}/installations/{installation_id}/preview")
def preview(solution_id: uuid.UUID, installation_id: uuid.UUID, target_version: int = Query(ge=1),
            db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    installation, agent = locked_installation(db, user, solution_id, installation_id)
    baseline = _version(db, user, solution_id, installation.version_number)
    target = _version(db, user, solution_id, target_version)
    try:
        plan = plan_update(SolutionSettings.model_validate(baseline.settings), shared_settings(agent),
                           SolutionSettings.model_validate(target.settings),
                           local_overrides=frozenset(override_fields(installation)))
    except ValidationError as exc:
        raise HTTPException(409, "Published settings require review") from exc
    return {"installation_id": installation.id, "agent_id": agent.id,
        "installed_version": installation.version_number, "target_version": target.number,
        "revision": installation.revision, "agent_updated_at": agent.updated_at,
        "changes": [asdict(change) for change in plan.changes], "conflicts": list(plan.conflicts),
        "local_overrides": sorted(override_fields(installation)),
        "detected_overrides": sorted(plan.local_overrides), "can_apply": False}


@router.post("/{solution_id}/installations/{installation_id}/protected-fields", response_model=InstallationOut)
def protect_field(solution_id: uuid.UUID, installation_id: uuid.UUID, payload: ProtectField,
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    installation, agent = locked_installation(db, user, solution_id, installation_id)
    if installation.revision != payload.expected_revision or agent.updated_at != payload.expected_agent_updated_at:
        raise HTTPException(409, "Preview changed; reload before protecting a setting")
    shared_settings(agent)
    fields = override_fields(installation)
    if payload.field not in fields:
        installation.local_overrides = sorted(fields | {payload.field})
        installation.revision += 1
    db.commit()
    return installation
