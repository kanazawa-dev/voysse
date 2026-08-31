"""Adopt the Voysse blue brand as the agency default.

Revision ID: 0018_voysse_blue_brand
Revises: 0017_whatsapp_cloud_channel
"""

from alembic import op


revision = "0018_voysse_blue_brand"
down_revision = "0017_whatsapp_cloud_channel"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE agencies ALTER COLUMN brand_color SET DEFAULT '#1748c7'")
    op.execute("UPDATE agencies SET brand_color = '#1748c7' WHERE lower(brand_color) = '#075985'")


def downgrade() -> None:
    op.execute("UPDATE agencies SET brand_color = '#075985' WHERE lower(brand_color) = '#1748c7'")
    op.execute("ALTER TABLE agencies ALTER COLUMN brand_color SET DEFAULT '#075985'")
