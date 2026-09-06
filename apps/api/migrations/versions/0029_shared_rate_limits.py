"""Share public request quotas across API processes."""
from alembic import op
import sqlalchemy as sa

revision = "0029_shared_rate_limits"
down_revision = "0028_portal_delivery"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("rate_limit_buckets",
        sa.Column("key", sa.String(64), primary_key=True),
        sa.Column("hits", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_rate_limit_buckets_expires_at", "rate_limit_buckets", ["expires_at"])


def downgrade():
    op.drop_table("rate_limit_buckets")
