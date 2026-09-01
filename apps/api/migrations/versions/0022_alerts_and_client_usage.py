"""Agency alerts, and optional cost-per-token rates for client usage estimates.

Revision ID: 0022_alerts_and_client_usage
Revises: 0021_cloud_lead_status
"""

from alembic import op
import sqlalchemy as sa


revision = "0022_alerts_and_client_usage"
down_revision = "0021_cloud_lead_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agencies", sa.Column("cost_per_million_input_tokens", sa.Float(), nullable=True))
    op.add_column("agencies", sa.Column("cost_per_million_output_tokens", sa.Float(), nullable=True))

    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("agency_id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=60), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("resource_type", sa.String(length=40), nullable=True),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alerts_agency_id"), "alerts", ["agency_id"])
    op.create_index(op.f("ix_alerts_created_at"), "alerts", ["created_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_alerts_created_at"), table_name="alerts")
    op.drop_index(op.f("ix_alerts_agency_id"), table_name="alerts")
    op.drop_table("alerts")
    op.drop_column("agencies", "cost_per_million_output_tokens")
    op.drop_column("agencies", "cost_per_million_input_tokens")
