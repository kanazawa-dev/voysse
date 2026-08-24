"""WhatsApp channel with encrypted session and Inbox.

Revision ID: 0003_whatsapp_channel
Revises: 0002_white_label_portal
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_whatsapp_channel"
down_revision = "0002_white_label_portal"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "whatsapp_channels",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agency_id", sa.Uuid(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.Column("agent_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=30), server_default="disconnected", nullable=False),
        sa.Column("phone_number", sa.String(length=80), nullable=True),
        sa.Column("display_name", sa.String(length=180), nullable=True),
        sa.Column("encrypted_auth_state", sa.Text(), nullable=True),
        sa.Column("encrypted_qr", sa.Text(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("last_connected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("client_id", name="uq_whatsapp_channels_client_id"),
    )
    op.create_index("ix_whatsapp_channels_agency_id", "whatsapp_channels", ["agency_id"])
    op.create_index("ix_whatsapp_channels_client_id", "whatsapp_channels", ["client_id"])
    op.create_index("ix_whatsapp_channels_agent_id", "whatsapp_channels", ["agent_id"])

    op.add_column("conversations", sa.Column("whatsapp_channel_id", sa.Uuid(), nullable=True))
    op.add_column("conversations", sa.Column("external_chat_id", sa.String(length=255), nullable=True))
    op.add_column("conversations", sa.Column("contact_name", sa.String(length=180), nullable=True))
    op.create_foreign_key(
        "fk_conversations_whatsapp_channel_id", "conversations", "whatsapp_channels",
        ["whatsapp_channel_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_conversations_whatsapp_channel_id", "conversations", ["whatsapp_channel_id"])
    op.create_unique_constraint(
        "uq_conversations_whatsapp_chat", "conversations", ["whatsapp_channel_id", "external_chat_id"]
    )

    op.add_column("messages", sa.Column("external_message_id", sa.String(length=255), nullable=True))
    op.create_unique_constraint(
        "uq_messages_conversation_external", "messages", ["conversation_id", "external_message_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_messages_conversation_external", "messages", type_="unique")
    op.drop_column("messages", "external_message_id")
    op.drop_constraint("uq_conversations_whatsapp_chat", "conversations", type_="unique")
    op.drop_index("ix_conversations_whatsapp_channel_id", table_name="conversations")
    op.drop_constraint("fk_conversations_whatsapp_channel_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "contact_name")
    op.drop_column("conversations", "external_chat_id")
    op.drop_column("conversations", "whatsapp_channel_id")
    op.drop_index("ix_whatsapp_channels_agent_id", table_name="whatsapp_channels")
    op.drop_index("ix_whatsapp_channels_client_id", table_name="whatsapp_channels")
    op.drop_index("ix_whatsapp_channels_agency_id", table_name="whatsapp_channels")
    op.drop_table("whatsapp_channels")
