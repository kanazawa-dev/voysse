"""Status and notes on Cloud leads, for the admin panel's leads workflow.

Revision ID: 0021_cloud_lead_status
Revises: 0020_admin_and_agency_status
"""

from alembic import op
import sqlalchemy as sa


revision = "0021_cloud_lead_status"
down_revision = "0020_admin_and_agency_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("cloud_leads", sa.Column("status", sa.String(length=20), nullable=False, server_default="new"))
    op.add_column("cloud_leads", sa.Column("notes", sa.Text(), nullable=False, server_default=""))
    op.alter_column("cloud_leads", "status", server_default=None)
    op.alter_column("cloud_leads", "notes", server_default=None)


def downgrade() -> None:
    op.drop_column("cloud_leads", "notes")
    op.drop_column("cloud_leads", "status")
