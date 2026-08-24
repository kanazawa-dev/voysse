"""Add agent multimodal capabilities: image and audio recognition.

Revision ID: 0009_agent_capabilities
Revises: 0008_agent_timezone
"""

import sqlalchemy as sa
from alembic import op


revision = "0009_agent_capabilities"
down_revision = "0008_agent_timezone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("image_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("agents", sa.Column("image_model", sa.String(length=180), nullable=False, server_default=""))
    op.add_column("agents", sa.Column("audio_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("agents", sa.Column("audio_model", sa.String(length=180), nullable=False, server_default="whisper-1"))


def downgrade() -> None:
    op.drop_column("agents", "audio_model")
    op.drop_column("agents", "audio_enabled")
    op.drop_column("agents", "image_model")
    op.drop_column("agents", "image_enabled")
