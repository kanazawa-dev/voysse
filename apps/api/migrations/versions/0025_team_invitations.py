"""Agency team invitations, consumed atomically."""
from alembic import op
import sqlalchemy as sa

revision = "0025_team_invitations"
down_revision = "0024_password_recovery"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("team_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agency_id", sa.Uuid(), sa.ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("role", sa.String(30), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_team_invitations_agency_id", "team_invitations", ["agency_id"])


def downgrade():
    op.drop_table("team_invitations")
