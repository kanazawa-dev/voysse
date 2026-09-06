"""Store client-scoped draft handoff rules without enabling execution."""
from alembic import op
import sqlalchemy as sa

revision = "0031_handoff_drafts"
down_revision = "0030_qr_events"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("clients", sa.Column("handoff_draft", sa.JSON(), nullable=False, server_default="{}"))


def downgrade():
    op.drop_column("clients", "handoff_draft")
