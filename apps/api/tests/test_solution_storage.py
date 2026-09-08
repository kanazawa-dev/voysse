import uuid

import pytest
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError

from app.models import Agency, Agent, Client, Solution, SolutionInstallation, SolutionVersion
from conftest import TestingSession

SETTINGS = {"instructions": "Answer approved questions.", "personality": "Friendly",
            "temperature": 0.7, "max_tokens": 2048, "memory_limit": 30}


def seed_storage():
    """Keep schema/migration tests independent of the later API review slice."""
    with TestingSession.begin() as db:
        agency = Agency(name="Storage test", slug=uuid.uuid4().hex)
        db.add(agency)
        db.flush()
        client = Client(agency_id=agency.id, name="Client", portal_slug=uuid.uuid4().hex)
        solution = Solution(agency_id=agency.id, name="Support")
        db.add_all([client, solution])
        db.flush()
        agent = Agent(agency_id=agency.id, client_id=client.id, name="Agent", is_active=False,
                      widget_enabled=False, model="", **SETTINGS)
        version = SolutionVersion(solution_id=solution.id, agency_id=agency.id, number=1,
                                  actor_id=uuid.uuid4(), settings=SETTINGS)
        db.add_all([agent, version])
        db.flush()
        installation = SolutionInstallation(agency_id=agency.id, solution_id=solution.id,
            version_number=1, client_id=client.id, agent_id=agent.id)
        db.add(installation)
        db.flush()
        return solution.id, client.id, {"id": str(installation.id), "agent_id": str(agent.id)}


def test_versions_reject_raw_updates_and_installed_version_deletion():
    solution, _, _ = seed_storage()
    with pytest.raises(IntegrityError), TestingSession.begin() as db:
        db.execute(update(SolutionVersion).where(SolutionVersion.solution_id == solution).values(settings=SETTINGS))
    with pytest.raises(IntegrityError), TestingSession.begin() as db:
        db.execute(delete(SolutionVersion).where(SolutionVersion.solution_id == solution))


def test_uninstalled_version_cannot_be_deleted_and_replaced():
    solution, _, installed = seed_storage()
    with TestingSession.begin() as db:
        db.execute(delete(Agent).where(Agent.id == uuid.UUID(installed["agent_id"])))
    with pytest.raises(IntegrityError), TestingSession.begin() as db:
        db.execute(delete(SolutionVersion).where(SolutionVersion.solution_id == solution))


def test_installed_solution_cannot_leave_agents_without_provenance():
    solution, _, _ = seed_storage()
    with pytest.raises(IntegrityError), TestingSession.begin() as db:
        db.execute(delete(Solution).where(Solution.id == solution))
    with TestingSession() as db:
        assert db.get(Solution, solution) is not None
        assert db.scalar(select(SolutionInstallation)) is not None


@pytest.mark.parametrize("field", ["agency_id", "client_id", "agent_id", "version_number"])
def test_storage_rejects_inconsistent_installation_scope(field):
    _, _, installed = seed_storage()
    _, other_client, other = seed_storage()
    with TestingSession() as db:
        other_agency = db.scalar(select(Client.agency_id).where(Client.id == other_client))
    value = {"agency_id": other_agency, "client_id": other_client,
             "agent_id": uuid.UUID(other["agent_id"]), "version_number": 999}[field]
    with pytest.raises(IntegrityError), TestingSession.begin() as db:
        db.execute(update(SolutionInstallation).where(SolutionInstallation.id == uuid.UUID(installed["id"]))
                   .values(**{field: value}))


def test_version_cannot_claim_another_agency():
    solution, _, _ = seed_storage()
    with TestingSession.begin() as db:
        agency = Agency(name="Other", slug="other")
        db.add(agency)
        db.flush()
        agency_id = agency.id
    with pytest.raises(IntegrityError), TestingSession.begin() as db:
        db.add(SolutionVersion(solution_id=solution, agency_id=agency_id, number=2,
                               actor_id=uuid.uuid4(), settings=SETTINGS))


@pytest.mark.parametrize("owner", [Agent, Client, Agency])
def test_owner_deletion_cascades_installation_without_blocking_erasure(owner):
    seed_storage()
    with TestingSession.begin() as db:
        db.execute(delete(owner))
    with TestingSession() as db:
        assert db.scalar(select(SolutionInstallation)) is None
        if owner == Agency:
            assert db.scalar(select(SolutionVersion)) is None
            assert db.scalar(select(Solution)) is None
