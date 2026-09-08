"""Pure, fail-closed previews for reusable solution behavior updates.

This module has no persistence, tenant authorization, activation or provider I/O.
Callers must eventually authorize scope and atomically recheck revisions before
applying a preview. A valid configuration is not a behavioral quality certificate.
"""
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SolutionSettings(BaseModel):
    """Complete, explicitly authored reusable settings, never an agent export.

    Client identity, knowledge, credentials, provider/model and channel bindings
    are deliberately excluded. Free text still needs review for client data.
    Required fields prevent an omitted field from silently resetting a setting.
    """

    model_config = ConfigDict(
        extra="forbid", frozen=True, strict=True,
        allow_inf_nan=False, revalidate_instances="always",
    )

    instructions: str = Field(max_length=32000)
    personality: str = Field(max_length=8000)
    temperature: float = Field(ge=0, le=2)
    max_tokens: int = Field(ge=1, le=32000)
    memory_limit: int = Field(ge=0, le=200)


SettingValue = str | float | int
ChangeStatus = Literal["unchanged", "updated", "preserved", "conflict"]


@dataclass(frozen=True)
class SettingChange:
    field: str
    status: ChangeStatus
    baseline: SettingValue
    current: SettingValue
    target: SettingValue


@dataclass(frozen=True)
class UpdatePlan:
    changes: tuple[SettingChange, ...]
    # None on ANY conflict: no partially applicable configuration is returned.
    configuration: SolutionSettings | None
    # Persist these with the installation after a successful future apply.
    local_overrides: frozenset[str]

    @property
    def conflicts(self) -> tuple[str, ...]:
        return tuple(change.field for change in self.changes if change.status == "conflict")


def plan_update(
    baseline: SolutionSettings,
    current: SolutionSettings,
    target: SolutionSettings,
    *,
    local_overrides: frozenset[str] = frozenset(),
) -> UpdatePlan:
    """Compare full snapshots; never overwrite divergent local edits.

    Explicit override markers preserve intent even when a local value equals the
    old default. Unmarked edits are detected conservatively and retain provenance
    if they converge with the target. Removing an override is a separate future
    user action, not something inferred from matching values.

    An older target can preview a configuration rollback using the same rules;
    it cannot undo external effects or certify compatibility with current tools.
    """
    baseline = SolutionSettings.model_validate(baseline)
    current = SolutionSettings.model_validate(current)
    target = SolutionSettings.model_validate(target)
    fields = SolutionSettings.model_fields
    overrides = frozenset(local_overrides)
    if overrides - fields.keys():
        raise ValueError("Unknown local override field")

    candidate = current.model_dump()
    changes: list[SettingChange] = []
    retained = set(overrides)
    for field in fields:
        old, local, proposed = (getattr(snapshot, field) for snapshot in (baseline, current, target))
        status: ChangeStatus
        if field in overrides or local != old:
            retained.add(field)
            status = "conflict" if proposed != old and proposed != local else "preserved"
        elif proposed != local:
            candidate[field] = proposed
            status = "updated"
        else:
            status = "unchanged"
        changes.append(SettingChange(field, status, old, local, proposed))

    blocked = any(change.status == "conflict" for change in changes)
    return UpdatePlan(
        tuple(changes),
        None if blocked else SolutionSettings.model_validate(candidate),
        frozenset(retained),
    )
