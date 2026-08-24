"""Add custom portal domain to clients.

Revision ID: 0015_client_custom_domain
Revises: 0014_agent_brief
"""

import sqlalchemy as sa
from alembic import op


revision = "0015_client_custom_domain"
down_revision = "0014_agent_brief"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("portal_domain", sa.String(length=255), nullable=True))
    op.add_column("clients", sa.Column("portal_domain_verified", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("clients", sa.Column("portal_domain_token", sa.String(length=64), nullable=False, server_default=""))
    op.create_unique_constraint("uq_clients_portal_domain", "clients", ["portal_domain"])


def downgrade() -> None:
    op.drop_constraint("uq_clients_portal_domain", "clients", type_="unique")
    op.drop_column("clients", "portal_domain_token")
    op.drop_column("clients", "portal_domain_verified")
    op.drop_column("clients", "portal_domain")
