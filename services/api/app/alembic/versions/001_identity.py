"""Alembic migration 001: Identity tables.

Creates the core identity tables with UUID primary keys.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

# revision identifiers, used by Alembic
revision = "001"
down_revision = "000"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("auth_issuer", sa.Text(), nullable=False),
        sa.Column("auth_subject", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("locale", sa.Text(), nullable=False, server_default="en"),
        sa.Column("status", sa.Text(), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("auth_issuer", "auth_subject", name="uq_users_auth"),
        schema="app",
    )

    op.create_table(
        "user_private",
        sa.Column("user_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.Text()),
        sa.Column("phone", sa.Text()),
        sa.Column("preferences", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("personalization_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("marketing_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app.users.id"],
        ),
        schema="app",
    )

    op.create_table(
        "consent_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("purpose", sa.Text(), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False),
        sa.Column("policy_version", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app.users.id"],
        ),
        schema="app",
    )

    op.create_table(
        "organizations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="active"),
        sa.Column("verification", sa.Text(), nullable=False, server_default="pending"),
        sa.Column("public_contact", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="app",
    )

    op.create_table(
        "organization_members",
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("organization_id", "user_id", name="pk_organization_members"),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["app.organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["app.users.id"],
        ),
        schema="app",
    )

    op.create_table(
        "staff_invitations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True)),
        sa.Column("invited_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["app.organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["invited_by"],
            ["app.users.id"],
        ),
        schema="app",
    )

    op.create_table(
        "verification_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("reviewer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("decision", sa.Text(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("evidence_object_key", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["app.organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["reviewer_id"],
            ["app.users.id"],
        ),
        schema="app",
    )

    op.create_table(
        "destinations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("parent_id", UUID(as_uuid=True)),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("country_code", sa.Text(), nullable=False, server_default="LB"),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["app.destinations.id"],
        ),
        schema="app",
    )

    op.create_table(
        "venues",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("destination_id", UUID(as_uuid=True)),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("timezone", sa.Text(), nullable=False, server_default="Asia/Beirut"),
        sa.Column("location", sa.GEOGRAPHY(geometry_type="Point", srid=4326), nullable=False),  # type: ignore[attr-defined]
        sa.Column("location_source", sa.Text(), nullable=False),
        sa.Column("source_reference", sa.Text()),
        sa.Column("source_expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["app.organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["destination_id"],
            ["app.destinations.id"],
        ),
        schema="app",
    )

    op.create_table(
        "taxonomy",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        schema="app",
    )

    op.create_table(
        "experiences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("venue_id", UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.Text(), nullable=False, server_default="draft"),
        sa.Column("booking_mode", sa.Text(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("min_party", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("max_party", sa.Integer(), nullable=False),
        sa.Column("min_age", sa.Integer()),
        sa.Column("setting", sa.Text(), nullable=False),
        sa.Column("intensity", sa.SmallInteger()),
        sa.Column("weather_rules", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("freshness_seconds", sa.Integer(), nullable=False, server_default=sa.text("86400")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["app.organizations.id"],
        ),
        sa.ForeignKeyConstraint(
            ["venue_id"],
            ["app.venues.id"],
        ),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("experiences", schema="app")
    op.drop_table("taxonomy", schema="app")
    op.drop_table("venues", schema="app")
    op.drop_table("destinations", schema="app")
    op.drop_table("verification_events", schema="app")
    op.drop_table("staff_invitations", schema="app")
    op.drop_table("organization_members", schema="app")
    op.drop_table("organizations", schema="app")
    op.drop_table("consent_events", schema="app")
    op.drop_table("user_private", schema="app")
    op.drop_table("users", schema="app")
