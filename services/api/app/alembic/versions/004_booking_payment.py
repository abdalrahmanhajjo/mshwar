"""Alembic migration 004: Booking and Payment tables.

Creates bookings, inquiries, booking_events, payments, refunds,
webhook_inbox, reviews, review_responses, support_cases, outbox,
notifications, votes, favorites, trip_templates.
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import SMALLINT, UUID

# revision identifiers, used by Alembic
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "votes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("trip_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("experience_id", UUID(as_uuid=True)),
        sa.Column("term_id", UUID(as_uuid=True)),
        sa.Column("value", SMALLINT(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["app.trips.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        sa.ForeignKeyConstraint(["term_id"], ["app.taxonomy.id"]),
        schema="app",
    )

    op.create_table(
        "favorites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("experience_id", UUID(as_uuid=True)),
        sa.Column("trip_id", UUID(as_uuid=True)),
        sa.ForeignKeyConstraint(["user_id"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        sa.ForeignKeyConstraint(["trip_id"], ["app.trips.id"]),
        schema="app",
    )

    op.create_table(
        "bookings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("slot_id", UUID(as_uuid=True), nullable=False),
        sa.Column("trip_stop_id", UUID(as_uuid=True)),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("mode", sa.Text(), nullable=False),
        sa.Column("hold_until", sa.DateTime(timezone=True)),
        sa.Column("response_due_at", sa.DateTime(timezone=True)),
        sa.Column("inventory_reserved", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("currency", sa.Text(), nullable=False),
        sa.Column("total_minor", sa.BigInteger(), nullable=False),
        sa.Column("payment_required", sa.Boolean(), nullable=False),
        sa.Column("price_snapshot", sa.JSON(), nullable=False),
        sa.Column("policy_snapshot", sa.JSON(), nullable=False),
        sa.Column("request_key", sa.Text(), nullable=False),
        sa.Column("request_hash", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["app.organizations.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        sa.ForeignKeyConstraint(["slot_id"], ["app.slots.id"]),
        sa.ForeignKeyConstraint(["trip_stop_id"], ["app.trip_stops.id"]),
        schema="app",
    )

    op.create_table(
        "inquiries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("customer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True)),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "booking_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("booking_id", UUID(as_uuid=True), nullable=False),
        sa.Column("actor_id", UUID(as_uuid=True)),
        sa.Column("from_status", sa.Text()),
        sa.Column("to_status", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["app.bookings.id"]),
        sa.ForeignKeyConstraint(["actor_id"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("booking_id", UUID(as_uuid=True), nullable=False),
        sa.Column("currency", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("provider_account", sa.Text(), nullable=False),
        sa.Column("live_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("external_id", sa.Text()),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="created"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["app.bookings.id"]),
        sa.ForeignKeyConstraint(["currency"], ["app.currencies(code"]),
        schema="app",
    )

    op.create_table(
        "refunds",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("payment_id", UUID(as_uuid=True), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column("external_id", sa.Text()),
        sa.Column("status", sa.Text(), nullable=False, server_default="requested"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["payment_id"], ["app.payments.id"]),
        schema="app",
    )

    op.create_table(
        "webhook_inbox",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("provider_account", sa.Text(), nullable=False),
        sa.Column("live_mode", sa.Boolean(), nullable=False),
        sa.Column("event_id", sa.Text(), nullable=False),
        sa.Column("payload_hash", sa.Text(), nullable=False),
        sa.Column("sanitized_payload", sa.JSON(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error_code", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="app",
    )

    op.create_table(
        "reviews",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("booking_id", UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rating", SMALLINT(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("moderation", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["app.bookings.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "review_responses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("review_id", UUID(as_uuid=True), nullable=False),
        sa.Column("author_id", UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("moderation", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["review_id"], ["app.reviews.id"]),
        sa.ForeignKeyConstraint(["author_id"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "support_cases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("reporter_id", UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_to", UUID(as_uuid=True)),
        sa.Column("booking_id", UUID(as_uuid=True)),
        sa.Column("experience_id", UUID(as_uuid=True)),
        sa.Column("review_id", UUID(as_uuid=True)),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("resolution", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["reporter_id"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["assigned_to"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["booking_id"], ["app.bookings.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        sa.ForeignKeyConstraint(["review_id"], ["app.reviews.id"]),
        schema="app",
    )

    op.create_table(
        "outbox",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("aggregate_id", UUID(as_uuid=True), nullable=False),
        sa.Column("dedupe_key", sa.Text(), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("claimed_until", sa.DateTime(timezone=True)),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error_code", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="app",
    )

    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("outbox_id", UUID(as_uuid=True), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("category", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["outbox_id"], ["app.outbox.id"]),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("notifications", schema="app")
    op.drop_table("outbox", schema="app")
    op.drop_table("support_cases", schema="app")
    op.drop_table("review_responses", schema="app")
    op.drop_table("reviews", schema="app")
    op.drop_table("webhook_inbox", schema="app")
    op.drop_table("refunds", schema="app")
    op.drop_table("payments", schema="app")
    op.drop_table("booking_events", schema="app")
    op.drop_table("inquiries", schema="app")
    op.drop_table("bookings", schema="app")
    op.drop_table("favorites", schema="app")
    op.drop_table("votes", schema="app")
