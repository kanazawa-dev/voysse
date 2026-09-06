"""Immutable policy publication, not transport activation."""
from alembic import op
import sqlalchemy as sa

revision = "0033_policy_versions"
down_revision = "0032_execution_state"
branch_labels = depends_on = None


def upgrade():
    op.create_table("policy_revisions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("client_id", sa.Uuid(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=False),
        sa.Column("request", sa.JSON(), nullable=False),
        sa.Column("policy", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("client_id", "revision", name="uq_policy_client_revision"))


def downgrade():
    op.drop_table("policy_revisions")
