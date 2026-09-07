"""Persist personal onboarding progress, separate from account configuration."""
from alembic import op
import sqlalchemy as sa

revision = "0037_user_onboarding"
down_revision = "0036_acquisition_counts"
branch_labels = depends_on = None


def upgrade():
    op.add_column("users", sa.Column("onboarding_state", sa.JSON(), server_default="{}", nullable=False))


def downgrade():
    op.drop_column("users", "onboarding_state")
