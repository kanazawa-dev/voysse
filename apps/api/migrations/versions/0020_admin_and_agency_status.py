"""Voysse team admin accounts, and an active/suspended flag on agencies.

Revision ID: 0020_admin_and_agency_status
Revises: 0019_cloud_leads
"""

from alembic import op
import sqlalchemy as sa


revision = "0020_admin_and_agency_status"
down_revision = "0019_cloud_leads"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agencies", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.alter_column("agencies", "is_active", server_default=None)

    op.create_table(
        "admin_users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_admin_users_email"), "admin_users", ["email"])
    op.create_unique_constraint("uq_admin_users_email", "admin_users", ["email"])


def downgrade() -> None:
    op.drop_constraint("uq_admin_users_email", "admin_users", type_="unique")
    op.drop_index(op.f("ix_admin_users_email"), table_name="admin_users")
    op.drop_table("admin_users")
    op.drop_column("agencies", "is_active")
