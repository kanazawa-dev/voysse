"""Persist QR inbound messages before acknowledging the bridge."""
from alembic import op
import sqlalchemy as sa

revision = "0030_qr_events"
down_revision = "0029_shared_rate_limits"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("whatsapp_qr_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("channel_id", sa.Uuid(), sa.ForeignKey("whatsapp_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("conversations.id", ondelete="SET NULL")),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("reply", sa.Text()),
        sa.Column("reply_metadata", sa.JSON(), nullable=False),
        sa.Column("error_code", sa.String(80)),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("channel_id", "external_id", name="uq_qr_event_external"))
    for column in ("channel_id", "status"):
        op.create_index(f"ix_whatsapp_qr_events_{column}", "whatsapp_qr_events", [column])


def downgrade():
    op.drop_table("whatsapp_qr_events")
