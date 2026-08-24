"""Switch AI config to per-agency provider keys (OpenAI/Anthropic).

Revision ID: 0007_provider_credentials
Revises: 0006_knowledge_chunks
"""

import sqlalchemy as sa
from alembic import op


revision = "0007_provider_credentials"
down_revision = "0006_knowledge_chunks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "provider_credentials",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agency_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("agency_id", "provider", name="uq_provider_credentials_agency_provider"),
    )
    op.create_index(op.f("ix_provider_credentials_agency_id"), "provider_credentials", ["agency_id"])

    op.add_column("agents", sa.Column("provider", sa.String(length=30), nullable=False, server_default="openai"))
    op.drop_column("agents", "connection_id")
    op.drop_table("ai_connections")


def downgrade() -> None:
    op.create_table(
        "ai_connections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agency_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=False, server_default="https://api.openai.com/v1"),
        sa.Column("model", sa.String(length=180), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.add_column("agents", sa.Column("connection_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(None, "agents", "ai_connections", ["connection_id"], ["id"], ondelete="SET NULL")
    op.drop_column("agents", "provider")
    op.drop_index(op.f("ix_provider_credentials_agency_id"), table_name="provider_credentials")
    op.drop_table("provider_credentials")
