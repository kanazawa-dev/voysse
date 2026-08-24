"""Marca blanca y portal de clientes.

Revision ID: 0002_white_label_portal
Revises: 0001_initial
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_white_label_portal"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agencies", sa.Column("slug", sa.String(length=180), nullable=True))
    op.add_column("agencies", sa.Column("brand_color", sa.String(length=20), server_default="#635bff", nullable=False))
    op.add_column("agencies", sa.Column("logo_data", sa.LargeBinary(), nullable=True))
    op.add_column("agencies", sa.Column("logo_mime", sa.String(length=100), nullable=True))
    op.execute("UPDATE agencies SET slug = 'agencia-' || substr(id::text, 1, 8)")
    op.alter_column("agencies", "slug", nullable=False)
    op.create_index("ix_agencies_slug", "agencies", ["slug"], unique=True)

    op.add_column("clients", sa.Column("portal_slug", sa.String(length=180), nullable=True))
    op.add_column("clients", sa.Column("portal_enabled", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("clients", sa.Column("portal_title", sa.String(length=180), server_default="", nullable=False))
    op.add_column("clients", sa.Column("portal_email", sa.String(length=320), nullable=True))
    op.add_column("clients", sa.Column("portal_password_hash", sa.String(length=255), nullable=True))
    op.execute("UPDATE clients SET portal_slug = 'cliente-' || substr(id::text, 1, 8)")
    op.alter_column("clients", "portal_slug", nullable=False)
    op.create_index("ix_clients_portal_slug", "clients", ["portal_slug"], unique=True)

    op.add_column("conversations", sa.Column("mode", sa.String(length=30), server_default="ai", nullable=False))
    op.add_column("conversations", sa.Column("channel", sa.String(length=40), server_default="playground", nullable=False))
    op.add_column("messages", sa.Column("sender_type", sa.String(length=30), server_default="visitor", nullable=False))
    op.add_column("messages", sa.Column("sender_name", sa.String(length=180), nullable=True))
    op.execute("UPDATE messages SET sender_type = CASE WHEN role = 'assistant' THEN 'ai' ELSE 'visitor' END")


def downgrade() -> None:
    op.drop_column("messages", "sender_name")
    op.drop_column("messages", "sender_type")
    op.drop_column("conversations", "channel")
    op.drop_column("conversations", "mode")
    op.drop_index("ix_clients_portal_slug", table_name="clients")
    op.drop_column("clients", "portal_password_hash")
    op.drop_column("clients", "portal_email")
    op.drop_column("clients", "portal_title")
    op.drop_column("clients", "portal_enabled")
    op.drop_column("clients", "portal_slug")
    op.drop_index("ix_agencies_slug", table_name="agencies")
    op.drop_column("agencies", "logo_mime")
    op.drop_column("agencies", "logo_data")
    op.drop_column("agencies", "brand_color")
    op.drop_column("agencies", "slug")
