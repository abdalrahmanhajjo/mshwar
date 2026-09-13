"""Alembic migration 002: Catalogue tables.

Creates taxonomy, media, opening_hours, opening_exceptions, blackouts,
currencies, price_rules, policies.
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import SMALLINT, TIME, TSRANGE, UUID

from alembic import op

# revision identifiers, used by Alembic
revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "experience_taxonomy",
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("term_id", UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("experience_id", "term_id", name="pk_experience_taxonomy"),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        sa.ForeignKeyConstraint(["term_id"], ["app.taxonomy.id"]),
        schema="app",
    )

    op.create_table(
        "experience_translations",
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("locale", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("experience_id", "locale", name="pk_experience_translations"),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "destination_translations",
        sa.Column("destination_id", UUID(as_uuid=True), nullable=False),
        sa.Column("locale", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("destination_id", "locale", name="pk_destination_translations"),
        sa.ForeignKeyConstraint(["destination_id"], ["app.destinations.id"]),
        schema="app",
    )

    op.create_table(
        "taxonomy_translations",
        sa.Column("taxonomy_id", UUID(as_uuid=True), nullable=False),
        sa.Column("locale", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.PrimaryKeyConstraint("taxonomy_id", "locale", name="pk_taxonomy_translations"),
        sa.ForeignKeyConstraint(["taxonomy_id"], ["app.taxonomy.id"]),
        schema="app",
    )

    op.create_table(
        "media",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False, server_default="imagekit"),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("alt_text", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("moderation", sa.Text(), nullable=False, server_default="pending"),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "opening_hours",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("venue_id", UUID(as_uuid=True), nullable=False),
        sa.Column("weekday", SMALLINT(), nullable=False),
        sa.Column("opens", TIME(), nullable=False),
        sa.Column("closes", TIME(), nullable=False),
        sa.ForeignKeyConstraint(["venue_id"], ["app.venues.id"]),
        schema="app",
    )

    op.create_table(
        "opening_exceptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("venue_id", UUID(as_uuid=True), nullable=False),
        sa.Column("local_date", sa.Date(), nullable=False),
        sa.Column("closed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("opens", TIME()),
        sa.Column("closes", TIME()),
        sa.ForeignKeyConstraint(["venue_id"], ["app.venues.id"]),
        schema="app",
    )

    op.create_table(
        "blackouts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("period", TSRANGE(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "currencies",
        sa.Column("code", sa.Text(), primary_key=True),
        sa.Column("minor_digits", SMALLINT(), nullable=False),
        schema="app",
    )

    op.create_table(
        "price_rules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("currency", sa.Text(), nullable=False),
        sa.Column("price_type", sa.Text(), nullable=False),
        sa.Column("unit", sa.Text(), nullable=False),
        sa.Column("amount_minor", sa.BigInteger()),
        sa.Column("max_amount_minor", sa.BigInteger()),
        sa.Column("valid_during", TSRANGE(), nullable=False),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        sa.ForeignKeyConstraint(["currency"], ["app.currencies.code"]),
        schema="app",
    )

    op.create_table(
        "policies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("cancellation_rules", sa.JSON(), nullable=False),
        sa.Column("terms_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "slots",
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


def downgrade() -> None:
    op.drop_table("slots", schema="app")
    op.drop_table("policies", schema="app")
    op.drop_table("price_rules", schema="app")
    op.drop_table("currencies", schema="app")
    op.drop_table("blackouts", schema="app")
    op.drop_table("opening_exceptions", schema="app")
    op.drop_table("opening_hours", schema="app")
    op.drop_table("media", schema="app")
    op.drop_table("taxonomy_translations", schema="app")
    op.drop_table("destination_translations", schema="app")
    op.drop_table("experience_translations", schema="app")
    op.drop_table("experience_taxonomy", schema="app")
