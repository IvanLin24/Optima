"""Optional company requisites and contact details; preserves existing accounts."""
from alembic import op
import sqlalchemy as sa

revision = "8c601e2a0901"
down_revision = "eb339db4a415"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("companies", sa.Column("profile_revision", sa.Integer(), nullable=False, server_default="0"))
    for name, length in [("kpp", 9), ("legal_address", 500), ("contact_name", 120), ("contact_phone", 40), ("contact_email", 254)]:
        op.add_column("companies", sa.Column(name, sa.String(length), nullable=True))


def downgrade():
    for name in ["contact_email", "contact_phone", "contact_name", "legal_address", "kpp"]:
        op.drop_column("companies", name)
    op.drop_column("companies", "profile_revision")
