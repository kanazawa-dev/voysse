"""Installation provenance; callers must lock the agent before its installation."""
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select

from ..models import SolutionInstallation
from .solution_updates import SolutionSettings


def shared_settings(agent, changes=None):
    values = {field: getattr(agent, field) for field in SolutionSettings.model_fields}
    values.update({k: v for k, v in (changes or {}).items() if k in values})
    try:
        return SolutionSettings.model_validate(values)
    except ValidationError as exc:
        raise HTTPException(422, "Installed settings are incompatible with solution previews") from exc


def override_fields(installation):
    fields = installation.local_overrides
    if not isinstance(fields, list) or any(not isinstance(f, str) or f not in SolutionSettings.model_fields for f in fields):
        raise HTTPException(409, "Installation metadata requires review")
    return set(fields)


def record_personalizations(db, agent, values):
    """No-op submissions do not express override intent; use explicit protection."""
    touched = set(values) & SolutionSettings.model_fields.keys()
    if not touched:
        return
    installation = db.scalar(select(SolutionInstallation).where(
        SolutionInstallation.agent_id == agent.id, SolutionInstallation.agency_id == agent.agency_id
    ).with_for_update().execution_options(populate_existing=True))
    if installation is None:
        return
    shared_settings(agent, values)
    changed = {field for field in touched if values[field] != getattr(agent, field)}
    if changed:
        installation.local_overrides = sorted(override_fields(installation) | changed)
        installation.revision += 1
