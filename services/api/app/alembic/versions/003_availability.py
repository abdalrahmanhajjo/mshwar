"""Alembic migration 003: Availability tables.

Creates availability_slots, trips, trip_members, trip_share_links,
trip_templates, trip_template_stops.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic
revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "availability_slots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("reserved", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("authoritative", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "trips",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("owner_id", UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="draft"),
        sa.Column("lock_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "trip_members",
        sa.Column("trip_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("shared_preferences", sa.JSON(), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("trip_id", "user_id", name="pk_trip_members"),
        sa.ForeignKeyConstraint(["trip_id"], ["app.trips.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "trip_share_links",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("trip_id", UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["app.trips.id"]),
        schema="app",
    )

    op.create_table(
        "trip_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("trip_id", UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("origin", sa.Text(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("return_by", sa.DateTime(timezone=True), nullable=False),
        sa.Column("start_location", sa.GEOGRAPHY(geometry_type="Point", srid=4326), nullable=False),  # type: ignore[attr-defined]
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("budget_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.Text(), nullable=False),
        sa.Column("strict_budget", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("constraints", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("validation", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("sealed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["app.trips.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["currency"], ["app.currencies(code"]),
        schema="app",
    )

    op.create_table(
        "trip_stops",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("version_id", UUID(as_uuid=True), nullable=False),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("estimated_minor", sa.BigInteger(), nullable=False),
        sa.Column("price_kind", sa.Text(), nullable=False),
        sa.Column("locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["app.trip_versions.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "trip_legs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("version_id", UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("distance_m", sa.Integer()),
        sa.Column("duration_seconds", sa.Integer()),
        sa.Column("estimated_minor", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["app.trip_versions.id"]),
        schema="app",
    )

    op.create_table(
        "trip_cost_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("version_id", UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["app.trip_versions.id"]),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("trip_cost_items", schema="app")
    op.drop_table("trip_legs", schema="app")
    op.drop_table("trip_stops", schema="app")
    op.drop_table("trip_versions", schema="app")
    op.drop_table("trip_share_links", schema="app")
    op.drop_table("trip_members", schema="app")
    op.drop_table("trips", schema="app")
    op.drop_table("availability_slots", schema="app")
