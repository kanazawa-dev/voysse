"""Add operator read marker to conversations.

Revision ID: 0013_conversation_read
Revises: 0012_agent_qa
"""

import sqlalchemy as sa
from alembic import op


revision = "0013_conversation_read"
down_revision = "0012_agent_qa"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("operator_read_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("conversations", "operator_read_at")
