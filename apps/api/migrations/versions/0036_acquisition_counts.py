"""Aggregate campaign counters without visitor identifiers."""
from alembic import op
import sqlalchemy as sa

revision = "0036_acquisition_counts"
down_revision = "0035_studio_layout"
branch_labels = depends_on = None


def upgrade():
    op.create_table("acquisition_counts",
        sa.Column("day", sa.Date(), primary_key=True),
        sa.Column("source", sa.String(80), primary_key=True),
        sa.Column("event", sa.String(16), primary_key=True),
        sa.Column("count", sa.BigInteger(), nullable=False))


def downgrade():
    op.drop_table("acquisition_counts")
