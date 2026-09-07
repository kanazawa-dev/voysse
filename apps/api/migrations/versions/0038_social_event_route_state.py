"""Durable handle for a prepared-but-not-yet-sent routed reply on a social event."""
from alembic import op
import sqlalchemy as sa

revision = "0038_social_event_route_state"
down_revision = "0037_user_onboarding"
branch_labels = depends_on = None


def upgrade():
    op.add_column("social_events", sa.Column("route_state", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("social_events", "route_state")
