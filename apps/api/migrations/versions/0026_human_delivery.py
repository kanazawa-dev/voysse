"""Durable human-send attempts; never blindly replay ambiguous delivery."""
from alembic import op
import sqlalchemy as sa

revision = "0026_human_delivery"
down_revision = "0025_team_invitations"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("human_deliveries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sender_name", sa.String(160), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("error_code", sa.String(80), nullable=True),
        sa.Column("external_message_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_human_deliveries_conversation_id", "human_deliveries", ["conversation_id"])


def downgrade():
    op.drop_table("human_deliveries")
