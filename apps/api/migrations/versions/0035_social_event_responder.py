"""Carry the routed responder's name from generation to the deferred send."""
from alembic import op
import sqlalchemy as sa

revision = "0035_social_event_responder"
down_revision = "0034_acquisition_counts"
branch_labels = depends_on = None


def upgrade():
    op.add_column("social_events", sa.Column("responder_name", sa.String(180), nullable=True))


def downgrade():
    op.drop_column("social_events", "responder_name")
