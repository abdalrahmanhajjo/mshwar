"""Migration 002: Catalogue tables (businesses, categories, experiences, price_rules, operating_hours).

Creates the business listings, categories, experiences, pricing and hours.
Re-runnable: Uses DROP TABLE cascade and recreates from empty.
"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "businesses",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("icon", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "experiences",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("price_type", sa.String(50), nullable=False, server_default="fixed"),
        sa.Column("price_amount", sa.Float(), nullable=True),
        sa.Column("price_currency", sa.String(3), nullable=False, server_default="LBP"),
        sa.Column("suitable_for_groups", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("indoor_outdoor", sa.String(20), nullable=False, server_default="indoor"),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "price_rules",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("experience_id", sa.Integer(), sa.ForeignKey("experiences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="LBP"),
        sa.Column("price_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Float(), nullable=True),
        sa.Column("min_group_size", sa.Integer(), nullable=True),
        sa.Column("max_group_size", sa.Integer(), nullable=True),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effective_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "operating_hours",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("open_time", sa.String(5), nullable=True),
        sa.Column("close_time", sa.String(5), nullable=True),
        sa.Column("is_closed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("exception_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index("ix_businesses_category", "businesses", ["category"])
    op.create_index("ix_businesses_status", "businesses", ["status"])
    op.create_index("ix_experiences_business_id", "experiences", ["business_id"])
    op.create_index("ix_experiences_category_id", "experiences", ["category_id"])
    op.create_index("ix_experiences_status", "experiences", ["status"])
    op.create_index("ix_price_rules_experience_id", "price_rules", ["experience_id"])
    op.create_index("ix_operating_hours_business_id", "operating_hours", ["business_id"])


def downgrade() -> None:
    op.drop_index("ix_operating_hours_business_id", table_name="operating_hours")
    op.drop_index("ix_price_rules_experience_id", table_name="price_rules")
    op.drop_index("ix_experiences_status", table_name="experiences")
    op.drop_index("ix_experiences_category_id", table_name="experiences")
    op.drop_index("ix_experiences_business_id", table_name="experiences")
    op.drop_index("ix_businesses_status", table_name="businesses")
    op.drop_index("ix_businesses_category", table_name="businesses")
    op.drop_table("operating_hours")
    op.drop_table("price_rules")
    op.drop_table("experiences")
    op.drop_table("categories")
    op.drop_table("businesses")
