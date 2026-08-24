"""Add agent generation settings: temperature, max_tokens, memory_limit.

Revision ID: 0005_agent_generation_settings
Revises: 0004_openvoiss_brand
"""

import sqlalchemy as sa
from alembic import op


revision = "0005_agent_generation_settings"
down_revision = "0004_openvoiss_brand"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("temperature", sa.Float(), nullable=False, server_default="0.7"))
    op.add_column("agents", sa.Column("max_tokens", sa.Integer(), nullable=False, server_default="2048"))
    op.add_column("agents", sa.Column("memory_limit", sa.Integer(), nullable=False, server_default="30"))


def downgrade() -> None:
    op.drop_column("agents", "memory_limit")
    op.drop_column("agents", "max_tokens")
    op.drop_column("agents", "temperature")
