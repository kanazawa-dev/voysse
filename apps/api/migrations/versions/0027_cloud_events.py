"""Durable admission of WhatsApp Cloud events."""
from alembic import op
import sqlalchemy as sa

revision = "0027_cloud_events"
down_revision = "0026_human_delivery"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("messages", sa.Column("external_received_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table("whatsapp_cloud_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("channel_id", sa.Uuid(), sa.ForeignKey("whatsapp_cloud_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("conversations.id", ondelete="SET NULL")),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("reply", sa.Text()),
        sa.Column("reply_metadata", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(80)),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("channel_id", "external_id", name="uq_cloud_event_external"),
    )
    op.create_index("ix_whatsapp_cloud_events_channel_id", "whatsapp_cloud_events", ["channel_id"])
    op.create_index("ix_whatsapp_cloud_events_status", "whatsapp_cloud_events", ["status"])


def downgrade():
    op.drop_table("whatsapp_cloud_events")
    op.drop_column("messages", "external_received_at")
