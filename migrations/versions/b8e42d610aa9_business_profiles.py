"""Separate business identities without changing existing companies or sessions."""
from alembic import op
import sqlalchemy as sa

revision = "b8e42d610aa9"
down_revision = "8c601e2a0901"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("business_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("company_id", sa.String(36), sa.ForeignKey("companies.id"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.UniqueConstraint("user_id", "role"), sa.UniqueConstraint("company_id"))
    op.create_index("ix_business_profiles_user_id", "business_profiles", ["user_id"])
    # Existing accounts are attached lazily under a row lock on first access.


def downgrade():
    op.drop_table("business_profiles")
