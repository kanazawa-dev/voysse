"""Identify portal senders separately from agency users."""
from alembic import op
import sqlalchemy as sa

revision = "0028_portal_delivery"
down_revision = "0027_cloud_events"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("human_deliveries", sa.Column("portal_client_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_delivery_portal_client", "human_deliveries", "clients",
                          ["portal_client_id"], ["id"], ondelete="CASCADE")


def downgrade():
    op.drop_constraint("fk_delivery_portal_client", "human_deliveries", type_="foreignkey")
    op.drop_column("human_deliveries", "portal_client_id")
