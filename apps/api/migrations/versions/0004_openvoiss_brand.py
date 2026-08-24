"""Actualiza el color predeterminado de la identidad Openvoiss.

Revision ID: 0004_openvoiss_brand
Revises: 0003_whatsapp_channel
"""

from alembic import op


revision = "0004_openvoiss_brand"
down_revision = "0003_whatsapp_channel"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE agencies ALTER COLUMN brand_color SET DEFAULT '#075985'")
    op.execute("UPDATE agencies SET brand_color = '#075985' WHERE lower(brand_color) = '#635bff'")


def downgrade() -> None:
    op.execute("UPDATE agencies SET brand_color = '#635bff' WHERE lower(brand_color) = '#075985'")
    op.execute("ALTER TABLE agencies ALTER COLUMN brand_color SET DEFAULT '#635bff'")
