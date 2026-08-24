"""Add agent custom tools (HTTP endpoints and MCP servers) and message tool-call metadata.

Revision ID: 0016_agent_tools
Revises: 0015_client_custom_domain
"""

import sqlalchemy as sa
from alembic import op


revision = "0016_agent_tools"
down_revision = "0015_client_custom_domain"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_tools",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agent_id", sa.Uuid(), sa.ForeignKey("agents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("url", sa.Text(), nullable=False, server_default=""),
        sa.Column("http_method", sa.String(length=10), nullable=False, server_default="GET"),
        sa.Column("prompt_instructions", sa.Text(), nullable=False, server_default=""),
        sa.Column("body_params", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("query_params", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("timeout_seconds", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("transport", sa.String(length=20), nullable=False, server_default="streamable_http"),
        sa.Column("cached_tools", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("tools_cached_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("encrypted_headers", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("agent_id", "name", name="uq_agent_tools_agent_name"),
    )
    op.create_index("ix_agent_tools_agent_id", "agent_tools", ["agent_id"])
    op.add_column("messages", sa.Column("tool_calls", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("messages", "tool_calls")
    op.drop_index("ix_agent_tools_agent_id", table_name="agent_tools")
    op.drop_table("agent_tools")
