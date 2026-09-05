"""Social accounts and a durable inbox/outbox for Instagram and Messenger."""
from alembic import op
import sqlalchemy as sa

revision = "0023_social_channels"
down_revision = "0022_alerts_and_client_usage"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("social_channels",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("agency_id", sa.Uuid(), sa.ForeignKey("agencies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("client_id", sa.Uuid(), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False),
        sa.Column("agent_id", sa.Uuid(), sa.ForeignKey("agents.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("platform", sa.String(20), nullable=False),
        sa.Column("account_id", sa.String(80), nullable=False),
        sa.Column("display_name", sa.String(180), nullable=False),
        sa.Column("encrypted_access_token", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.Column("last_error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("client_id", "platform", name="uq_social_client_platform"),
        sa.UniqueConstraint("platform", "account_id", name="uq_social_account"))
    for column in ("agency_id", "client_id"):
        op.create_index(f"ix_social_channels_{column}", "social_channels", [column])
    op.add_column("conversations", sa.Column("social_channel_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_conversations_social_channel", "conversations", "social_channels", ["social_channel_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_conversations_social_channel_id", "conversations", ["social_channel_id"])
    op.create_unique_constraint("uq_conversations_social_chat", "conversations", ["social_channel_id", "external_chat_id"])
    op.create_table("social_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("channel_id", sa.Uuid(), sa.ForeignKey("social_channels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("conversations.id", ondelete="CASCADE")),
        sa.Column("external_id", sa.String(255), nullable=False),
        sa.Column("sender_id", sa.String(255), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("supported", sa.Boolean(), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("reply", sa.Text()),
        sa.Column("last_error", sa.Text()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("channel_id", "external_id", name="uq_social_event"))
    for column in ("channel_id", "status"):
        op.create_index(f"ix_social_events_{column}", "social_events", [column])


def downgrade():
    op.drop_table("social_events")
    op.drop_constraint("uq_conversations_social_chat", "conversations", type_="unique")
    op.drop_index("ix_conversations_social_channel_id", "conversations")
    op.drop_constraint("fk_conversations_social_channel", "conversations", type_="foreignkey")
    op.drop_column("conversations", "social_channel_id")
    op.drop_table("social_channels")
