"""Cloud interest leads from the marketing site's "Choose Cloud" CTA.

Revision ID: 0019_cloud_leads
Revises: 0018_voysse_blue_brand
"""

from alembic import op
import sqlalchemy as sa


revision = "0019_cloud_leads"
down_revision = "0018_voysse_blue_brand"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cloud_leads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("agency_name", sa.String(length=180), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("cloud_leads")
