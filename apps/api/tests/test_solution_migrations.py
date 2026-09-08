"""Migration runtime harness, guarded by conftest's disposable database rule."""
import uuid

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select, update
from sqlalchemy.exc import IntegrityError

from app.database import Base
from app.models import Agent, SolutionVersion
from conftest import TestingSession, test_engine
from test_solution_storage import SETTINGS, seed_storage


def test_real_migration_roundtrip_and_downgrade_preserves_agents():
    config = Config("alembic.ini")
    # Historical migration constraint names differ from metadata.create_all().
    # Start empty and exercise actual DDL, never downgrade a fabricated schema.
    Base.metadata.drop_all(test_engine)
    command.stamp(config, "base")
    command.upgrade(config, "head")
    command.downgrade(config, "base")
    assert "solutions" not in inspect(test_engine).get_table_names()
    command.upgrade(config, "head")
    _, _, installed = seed_storage()
    agent_id = uuid.UUID(installed["agent_id"])
    with pytest.raises(IntegrityError), TestingSession.begin() as db:
        db.execute(update(SolutionVersion).values(settings=SETTINGS))
    command.downgrade(config, "0038_social_event_route_state")
    assert "solutions" not in inspect(test_engine).get_table_names()
    with TestingSession() as db:
        agent = db.get(Agent, agent_id)
        assert agent is not None and agent.instructions == SETTINGS["instructions"]
        assert not agent.is_active and not agent.widget_enabled
    command.upgrade(config, "head")
    with TestingSession() as db:
        assert db.get(Agent, agent_id) is not None
        assert db.scalar(select(SolutionVersion)) is None
