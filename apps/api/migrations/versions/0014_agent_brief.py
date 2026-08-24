"""Add the agent structured business brief.

Revision ID: 0014_agent_brief
Revises: 0013_conversation_read
"""

import sqlalchemy as sa
from alembic import op


revision = "0014_agent_brief"
down_revision = "0013_conversation_read"
branch_labels = None
depends_on = None

BRIEF_COLUMNS = (
    "brief_summary",
    "brief_products",
    "brief_audience",
    "brief_policies",
    "brief_goal",
    "brief_dos",
    "brief_donts",
)


def upgrade() -> None:
    for column in BRIEF_COLUMNS:
        op.add_column("agents", sa.Column(column, sa.Text(), nullable=False, server_default=""))


def downgrade() -> None:
    for column in reversed(BRIEF_COLUMNS):
        op.drop_column("agents", column)
