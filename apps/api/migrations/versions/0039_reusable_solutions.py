"""Agency-scoped solution versions and isolated client installations."""
from alembic import op
import sqlalchemy as sa

revision = "0039_reusable_solutions"
down_revision = "0038_social_event_route_state"
branch_labels = depends_on = None


def upgrade():
    op.create_unique_constraint("uq_clients_id_agency", "clients", ["id", "agency_id"])
    op.create_unique_constraint("uq_agents_id_client_agency", "agents", ["id", "client_id", "agency_id"])
    op.create_table("solutions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agency_id", sa.Uuid(), sa.ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(180), nullable=False),
        sa.Column("latest_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("id", "agency_id", name="uq_solutions_id_agency"),
        sa.CheckConstraint("latest_version >= 1", name="ck_solutions_version"))
    op.create_index("ix_solutions_agency_id", "solutions", ["agency_id"])
    op.create_table("solution_versions",
        sa.Column("solution_id", sa.Uuid(), primary_key=True),
        sa.Column("number", sa.Integer(), primary_key=True),
        sa.Column("agency_id", sa.Uuid(), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["solution_id", "agency_id"], ["solutions.id", "solutions.agency_id"], ondelete="CASCADE"),
        sa.UniqueConstraint("solution_id", "number", "agency_id", name="uq_solution_versions_scope"),
        sa.CheckConstraint("number >= 1", name="ck_solution_versions_number"))
    op.create_index("ix_solution_versions_agency_id", "solution_versions", ["agency_id"])
    op.create_table("solution_installations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agency_id", sa.Uuid(), nullable=False),
        sa.Column("solution_id", sa.Uuid(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False, unique=True),
        sa.Column("local_overrides", sa.JSON(), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["solution_id", "version_number", "agency_id"],
            ["solution_versions.solution_id", "solution_versions.number", "solution_versions.agency_id"],
            deferrable=True, initially="DEFERRED"),
        sa.ForeignKeyConstraint(["client_id", "agency_id"], ["clients.id", "clients.agency_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id", "client_id", "agency_id"],
            ["agents.id", "agents.client_id", "agents.agency_id"], ondelete="CASCADE"),
        sa.UniqueConstraint("solution_id", "client_id", name="uq_solution_installation_client"),
        sa.CheckConstraint("revision >= 1", name="ck_solution_installation_revision"))
    op.create_index("ix_solution_installations_agency_id", "solution_installations", ["agency_id"])
    op.execute("""CREATE FUNCTION reject_solution_version_update() RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM solutions WHERE id = OLD.solution_id) THEN
                RETURN OLD;
            END IF;
            RAISE EXCEPTION 'Solution versions are immutable' USING ERRCODE = '23514';
        END;
        $$ LANGUAGE plpgsql""")
    op.execute("""CREATE TRIGGER immutable_solution_version BEFORE UPDATE OR DELETE ON solution_versions
        FOR EACH ROW EXECUTE FUNCTION reject_solution_version_update()""")


def downgrade():
    # Only remove library metadata. Installed agents are ordinary agents and remain.
    op.drop_table("solution_installations")
    op.drop_table("solution_versions")
    op.execute("DROP FUNCTION reject_solution_version_update()")
    op.drop_table("solutions")
    op.drop_constraint("uq_agents_id_client_agency", "agents", type_="unique")
    op.drop_constraint("uq_clients_id_agency", "clients", type_="unique")
