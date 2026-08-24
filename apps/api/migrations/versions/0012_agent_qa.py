"""Add agent Q&A pairs.

Revision ID: 0012_agent_qa
Revises: 0011_usage_records
"""

import sqlalchemy as sa
from alembic import op


revision = "0012_agent_qa"
down_revision = "0011_usage_records"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_qa",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agent_id", sa.Uuid(), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_agent_qa_agent_id", "agent_qa", ["agent_id"])


def downgrade() -> None:
    op.drop_index("ix_agent_qa_agent_id", table_name="agent_qa")
    op.drop_table("agent_qa")
