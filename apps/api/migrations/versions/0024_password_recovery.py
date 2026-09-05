"""Single-use password recovery and session revocation."""
from alembic import op
import sqlalchemy as sa

revision = "0024_password_recovery"
down_revision = "0023_social_channels"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("session_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("reset_token_hash", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("reset_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("reset_requested_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("uq_users_reset_token_hash", "users", ["reset_token_hash"])


def downgrade():
    op.drop_constraint("uq_users_reset_token_hash", "users", type_="unique")
    for column in ("reset_requested_at", "reset_expires_at", "reset_token_hash", "session_version"):
        op.drop_column("users", column)
