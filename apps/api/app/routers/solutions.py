"""Administrative library; publishing a version never updates installed agents."""
import uuid
from contextlib import contextmanager
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Agent, Client, Solution, SolutionInstallation, SolutionVersion, User
from ..services.solution_updates import SolutionSettings

router = APIRouter(prefix="/solutions", tags=["Solutions"])


class Request(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateSolution(Request):
    name: str = Field(min_length=1, max_length=180)
    settings: SolutionSettings

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value):
        if not value.strip():
            raise ValueError("Name must not be blank")
        return value.strip()


class PublishVersion(Request):
    expected_latest_version: int = Field(ge=1, strict=True)
    settings: SolutionSettings


class InstallSolution(Request):
    client_id: uuid.UUID
    version_number: int = Field(ge=1, strict=True)
    name: str = Field(min_length=1, max_length=180)

    @field_validator("name")
    @classmethod
    def nonblank_name(cls, value):
        return CreateSolution.nonblank_name(value)


class SolutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    latest_version: int
    created_at: datetime


class VersionSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    solution_id: uuid.UUID
    number: int
    created_at: datetime


class VersionOut(VersionSummary):
    settings: SolutionSettings


class InstallationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    solution_id: uuid.UUID
    version_number: int
    client_id: uuid.UUID
    agent_id: uuid.UUID
    revision: int
    local_overrides: list[str]
    created_at: datetime


def _solution(db, user, solution_id, *, lock=False):
    query = select(Solution).where(Solution.id == solution_id, Solution.agency_id == user.agency_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    result = db.scalar(query)
    if result is None:
        raise HTTPException(404, "Solution not found")
    return result


def _version(db, user, solution_id, number):
    version = db.scalar(select(SolutionVersion).where(SolutionVersion.solution_id == solution_id,
        SolutionVersion.number == number, SolutionVersion.agency_id == user.agency_id))
    if version is None:
        raise HTTPException(404, "Solution version not found")
    return version


@contextmanager
def _write(db):
    try:
        yield
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(409, "Solution changed or is already installed for this client") from exc


@router.get("", response_model=list[SolutionOut])
def list_solutions(limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Solution).where(Solution.agency_id == user.agency_id)
        .order_by(Solution.created_at.desc(), Solution.id).limit(limit).offset(offset)).all()


@router.post("", response_model=SolutionOut, status_code=201)
def create_solution(payload: CreateSolution, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    with _write(db):
        solution = Solution(agency_id=user.agency_id, name=payload.name)
        db.add(solution)
        db.flush()
        db.add(SolutionVersion(solution_id=solution.id, number=1, agency_id=user.agency_id,
                               actor_id=user.id, settings=payload.settings.model_dump()))
    return solution


@router.get("/{solution_id}/versions", response_model=list[VersionSummary])
def list_versions(solution_id: uuid.UUID, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                  db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _solution(db, user, solution_id)
    return db.scalars(select(SolutionVersion).where(SolutionVersion.solution_id == solution_id,
        SolutionVersion.agency_id == user.agency_id).order_by(SolutionVersion.number.desc())
        .limit(limit).offset(offset)).all()


@router.get("/{solution_id}/versions/{number}", response_model=VersionOut)
def get_version(solution_id: uuid.UUID, number: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _version(db, user, solution_id, number)


@router.post("/{solution_id}/versions", response_model=VersionOut, status_code=201)
def publish_version(solution_id: uuid.UUID, payload: PublishVersion,
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    with _write(db):
        solution = _solution(db, user, solution_id, lock=True)
        if solution.latest_version != payload.expected_latest_version:
            raise HTTPException(409, "Solution version changed; reload before publishing")
        solution.latest_version += 1
        version = SolutionVersion(solution_id=solution.id, number=solution.latest_version,
            agency_id=user.agency_id, actor_id=user.id, settings=payload.settings.model_dump())
        db.add(version)
    return version


@router.get("/{solution_id}/installations", response_model=list[InstallationOut])
def list_installations(solution_id: uuid.UUID, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0),
                       db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _solution(db, user, solution_id)
    return db.scalars(select(SolutionInstallation).where(SolutionInstallation.solution_id == solution_id,
        SolutionInstallation.agency_id == user.agency_id).order_by(SolutionInstallation.created_at, SolutionInstallation.id)
        .limit(limit).offset(offset)).all()


@router.post("/{solution_id}/installations", response_model=InstallationOut, status_code=201)
def install_solution(solution_id: uuid.UUID, payload: InstallSolution,
                     db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    with _write(db):
        version = _version(db, user, solution_id, payload.version_number)
        client = db.scalar(select(Client).where(Client.id == payload.client_id, Client.agency_id == user.agency_id)
                           .with_for_update())
        if client is None:
            raise HTTPException(404, "Client not found")
        if not client.is_active:
            raise HTTPException(409, "Client is inactive")
        config = SolutionSettings.model_validate(version.settings)
        agent = Agent(agency_id=user.agency_id, client_id=client.id, name=payload.name,
                      is_active=False, widget_enabled=False, model="", **config.model_dump())
        db.add(agent)
        db.flush()
        installation = SolutionInstallation(agency_id=user.agency_id, solution_id=solution_id,
            version_number=version.number, client_id=client.id, agent_id=agent.id)
        db.add(installation)
    return installation
