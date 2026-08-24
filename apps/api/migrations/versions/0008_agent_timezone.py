"""Add agent timezone.

Revision ID: 0008_agent_timezone
Revises: 0007_provider_credentials
"""

import sqlalchemy as sa
from alembic import op


revision = "0008_agent_timezone"
down_revision = "0007_provider_credentials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("timezone", sa.String(length=64), nullable=False, server_default="UTC"))


def downgrade() -> None:
    op.drop_column("agents", "timezone")
