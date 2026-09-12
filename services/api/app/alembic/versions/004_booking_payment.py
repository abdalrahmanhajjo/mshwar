"""Migration 004: Booking and Payment tables (bookings, payments, refunds, reviews, trips, group_participants, votes, favorites).

Creates the transactional tables for booking flow, payments, group planning.
Re-runnable: Drops and recreates tables in dependency order.
"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trips",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Index("ix_trips_user_id", "trips", ["user_id"]),
        sa.Index("ix_trips_status", "trips", ["status"]),
    )

    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("price_snapshot", sa.Text(), nullable=True),
        sa.Column("policy_snapshot", sa.Text(), nullable=True),
        sa.Column("party_size", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('draft','pending','confirmed','rejected','cancelled','completed','refunded')", name="chk_booking_status"),
        sa.Index("ix_bookings_business_id", "bookings", ["business_id"]),
        sa.Index("ix_bookings_status", "bookings", ["status"]),
        sa.Index("ix_bookings_trip_id", "bookings", ["trip_id"]),
    )

    op.create_table(
        "payments",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False, server_default="stripe"),
        sa.Column("provider_payment_id", sa.String(255), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="LBP"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('pending','succeeded','failed','refunded')", name="chk_payment_status"),
        sa.Index("ix_payments_booking_id", "payments", ["booking_id"]),
        sa.Index("ix_payments_status", "payments", ["status"]),
    )

    op.create_table(
        "refunds",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("booking_id", sa.Integer(), sa.ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payment_id", sa.Integer(), sa.ForeignKey("payments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="LBP"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("status IN ('pending','approved','rejected','completed','failed')", name="chk_refund_status"),
        sa.Index("ix_refunds_booking_id", "refunds", ["booking_id"]),
        sa.Index("ix_refunds_status", "refunds", ["status"]),
    )

    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("experience_id", sa.Integer(), sa.ForeignKey("experiences.id", ondelete="SET NULL"), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("rating BETWEEN 1 AND 5", name="chk_review_rating"),
        sa.CheckConstraint("status IN ('pending','approved','rejected')", name="chk_review_status"),
        sa.Index("ix_reviews_business_id", "reviews", ["business_id"]),
        sa.Index("ix_reviews_user_id", "reviews", ["user_id"]),
    )

    op.create_table(
        "group_participants",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("trip_id", "user_id", name="uq_group_participants_unique"),
        sa.Index("ix_group_participants_trip_id", "group_participants", ["trip_id"]),
    )

    op.create_table(
        "votes",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="CASCADE"), nullable=False),
        sa.Column("participant_id", sa.Integer(), sa.ForeignKey("group_participants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("experience_id", sa.Integer(), sa.ForeignKey("experiences.id", ondelete="SET NULL"), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Index("ix_votes_trip_id", "votes", ["trip_id"]),
    )

    op.create_table(
        "favorites",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("experience_id", sa.Integer(), sa.ForeignKey("experiences.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "business_id", name="uq_favorite_business"),
        sa.UniqueConstraint("user_id", "experience_id", name="uq_favorite_experience"),
        sa.Index("ix_favorites_user_id", "favorites", ["user_id"]),
    )


def downgrade() -> None:
    op.drop_index("ix_favorites_user_id", table_name="favorites")
    op.drop_index("uq_favorite_experience", table_name="favorites")
    op.drop_index("uq_favorite_business", table_name="favorites")
    op.drop_table("favorites")
    op.drop_index("ix_votes_trip_id", table_name="votes")
    op.drop_table("votes")
    op.drop_index("ix_group_participants_trip_id", table_name="group_participants")
    op.drop_index("uq_group_participants_unique", table_name="group_participants")
    op.drop_table("group_participants")
    op.drop_index("ix_reviews_user_id", table_name="reviews")
    op.drop_index("ix_reviews_business_id", table_name="reviews")
    op.drop_index("chk_review_status", table_name="reviews")
    op.drop_table("reviews")
    op.drop_index("ix_refunds_status", table_name="refunds")
    op.drop_index("ix_refunds_booking_id", table_name="refunds")
    op.drop_table("refunds")
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_index("ix_payments_booking_id", table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_bookings_trip_id", table_name="bookings")
    op.drop_index("ix_bookings_status", table_name="bookings")
    op.drop_index("ix_bookings_business_id", table_name="bookings")
    op.drop_table("bookings")
    op.drop_index("ix_trips_status", table_name="trips")
    op.drop_index("ix_trips_user_id", table_name="trips")
    op.drop_table("trips")
