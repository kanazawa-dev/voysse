"""WhatsApp Cloud API channel (official Meta Graph API).

Revision ID: 0017_whatsapp_cloud_channel
Revises: 0016_agent_tools
"""

from alembic import op
import sqlalchemy as sa


revision = "0017_whatsapp_cloud_channel"
down_revision = "0016_agent_tools"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_cloud_channels",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agency_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="disconnected", nullable=False),
        sa.Column("phone_number", sa.String(length=80), nullable=True),
        sa.Column("display_name", sa.String(length=180), nullable=True),
        sa.Column("phone_number_id", sa.String(length=80), server_default="", nullable=False),
        sa.Column("waba_id", sa.String(length=80), nullable=True),
        sa.Column("encrypted_access_token", sa.Text(), nullable=True),
        sa.Column("encrypted_app_secret", sa.Text(), nullable=True),
        sa.Column("webhook_verify_token", sa.String(length=64), server_default="", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("last_connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", name="uq_whatsapp_cloud_channels_client_id"),
    )
    op.create_index("ix_whatsapp_cloud_channels_agency_id", "whatsapp_cloud_channels", ["agency_id"])
    op.create_index("ix_whatsapp_cloud_channels_client_id", "whatsapp_cloud_channels", ["client_id"])
    op.create_index("ix_whatsapp_cloud_channels_agent_id", "whatsapp_cloud_channels", ["agent_id"])

    op.add_column("conversations", sa.Column("whatsapp_cloud_channel_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_conversations_whatsapp_cloud_channel_id", "conversations", "whatsapp_cloud_channels",
        ["whatsapp_cloud_channel_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_conversations_whatsapp_cloud_channel_id", "conversations", ["whatsapp_cloud_channel_id"])
    op.create_unique_constraint(
        "uq_conversations_whatsapp_cloud_chat", "conversations", ["whatsapp_cloud_channel_id", "external_chat_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_conversations_whatsapp_cloud_chat", "conversations", type_="unique")
    op.drop_index("ix_conversations_whatsapp_cloud_channel_id", table_name="conversations")
    op.drop_constraint("fk_conversations_whatsapp_cloud_channel_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "whatsapp_cloud_channel_id")
    op.drop_index("ix_whatsapp_cloud_channels_agent_id", table_name="whatsapp_cloud_channels")
    op.drop_index("ix_whatsapp_cloud_channels_client_id", table_name="whatsapp_cloud_channels")
    op.drop_index("ix_whatsapp_cloud_channels_agency_id", table_name="whatsapp_cloud_channels")
    op.drop_table("whatsapp_cloud_channels")
