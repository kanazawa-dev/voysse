"""Persist client-scoped visual layout independently of routing."""
from alembic import op
import sqlalchemy as sa

revision = "0035_studio_layout"
down_revision = "0034_turn_policy"
branch_labels = depends_on = None


def upgrade():
    op.add_column("clients", sa.Column("studio_layout", sa.JSON(), nullable=False, server_default='{}'))


def downgrade():
    op.drop_column("clients", "studio_layout")
