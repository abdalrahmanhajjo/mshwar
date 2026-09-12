"""Migration 001: Identity tables (users, business_members).

Creates the core identity and authentication tables.
Re-runnable: Uses CREATE TABLE IF NOT EXISTS and checks for existence.
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = "000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("length(email) <= 255", name="chk_users_email_length"),
    )

    op.create_table(
        "business_members",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("business_id", "user_id", "role", name="uq_business_members_unique"),
    )

    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_business_members_user_id", "business_members", ["user_id"])
    op.create_index("ix_business_members_business_id", "business_members", ["business_id"])


def downgrade() -> None:
    op.drop_index("ix_business_members_business_id", table_name="business_members")
    op.drop_index("ix_business_members_user_id", table_name="business_members")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("business_members")
    op.drop_table("users")
