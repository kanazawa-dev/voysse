"""Pin published policy identity to new opted-in execution turns."""
from alembic import op
import sqlalchemy as sa

revision = "0034_turn_policy"
down_revision = "0033_policy_versions"
branch_labels = depends_on = None


def upgrade():
    op.add_column("execution_turns", sa.Column("policy_revision_id", sa.Uuid(), nullable=True))


def downgrade():
    op.drop_column("execution_turns", "policy_revision_id")
