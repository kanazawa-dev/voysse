"""Add dormant single-responder state and durable execution claims."""
from alembic import op
import sqlalchemy as sa
revision = "0032_execution_state"
down_revision = "0031_handoff_drafts"
branch_labels = depends_on = None


def upgrade():
    op.create_table("conversation_runtimes",
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("responder_id", sa.Uuid(), sa.ForeignKey("agents.id", ondelete="SET NULL")),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("active_turn_id", sa.Uuid()))
    op.create_table("execution_turns",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("conversation_id", sa.Uuid(), sa.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("context_message_id", sa.Uuid(), nullable=False),
        sa.Column("request_revision", sa.Integer(), nullable=False),
        sa.Column("max_hops", sa.Integer(), nullable=False),
        sa.Column("source_agent_id", sa.Uuid(), nullable=False),
        sa.Column("responder_version", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("transitions", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("conversation_id", "context_message_id", name="uq_execution_turn_context"))
    op.create_index("ix_execution_turns_conversation_id", "execution_turns", ["conversation_id"])


def downgrade():
    op.drop_table("execution_turns")
    op.drop_table("conversation_runtimes")
