"""Add agent web chat widget fields.

Revision ID: 0010_agent_widget
Revises: 0009_agent_capabilities
"""

import sqlalchemy as sa
from alembic import op


revision = "0010_agent_widget"
down_revision = "0009_agent_capabilities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("widget_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("agents", sa.Column("widget_public_id", sa.String(length=64), nullable=True))
    op.add_column("agents", sa.Column("widget_greeting", sa.Text(), nullable=False, server_default=""))
    op.add_column("agents", sa.Column("widget_color", sa.String(length=20), nullable=False, server_default=""))
    op.add_column("agents", sa.Column("widget_position", sa.String(length=10), nullable=False, server_default="right"))
    op.execute("UPDATE agents SET widget_public_id = md5(random()::text || clock_timestamp()::text) WHERE widget_public_id IS NULL")
    op.alter_column("agents", "widget_public_id", nullable=False)
    op.create_index("ix_agents_widget_public_id", "agents", ["widget_public_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_agents_widget_public_id", table_name="agents")
    op.drop_column("agents", "widget_position")
    op.drop_column("agents", "widget_color")
    op.drop_column("agents", "widget_greeting")
    op.drop_column("agents", "widget_public_id")
    op.drop_column("agents", "widget_enabled")
