"""Add usage records for token accounting.

Revision ID: 0011_usage_records
Revises: 0010_agent_widget
"""

import sqlalchemy as sa
from alembic import op


revision = "0011_usage_records"
down_revision = "0010_agent_widget"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usage_records",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agency_id", sa.Uuid(), sa.ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.Uuid(), sa.ForeignKey("agents.id", ondelete="SET NULL"), nullable=True),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("model", sa.String(length=180), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("output_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_usage_records_agency_id", "usage_records", ["agency_id"])
    op.create_index("ix_usage_records_agent_id", "usage_records", ["agent_id"])
    op.create_index("ix_usage_records_created_at", "usage_records", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_usage_records_created_at", table_name="usage_records")
    op.drop_index("ix_usage_records_agent_id", table_name="usage_records")
    op.drop_index("ix_usage_records_agency_id", table_name="usage_records")
    op.drop_table("usage_records")
