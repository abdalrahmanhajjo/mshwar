"""Alembic migration 005: AI and Ops tables.

Creates knowledge_documents, knowledge_chunks, recommendation_runs,
recommendation_candidates, retrieval_sources, feedback_events,
evaluation_datasets, evaluation_cases, evaluation_runs,
evaluation_results, weather_snapshots, weather_warnings,
configuration_versions, commission_terms, booking_commissions,
analytics_events, data_quality_issues, audit_log, trip_templates,
trip_template_stops, user_private.
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector  # type: ignore[import-untyped]
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("experience_id", UUID(as_uuid=True)),
        sa.Column("destination_id", UUID(as_uuid=True)),
        sa.Column("locale", sa.Text(), nullable=False),
        sa.Column("source_uri", sa.Text(), nullable=False),
        sa.Column("content_hash", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("approved_by", UUID(as_uuid=True)),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.Column("expires_at", sa.DateTime(timezone=True)),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        sa.ForeignKeyConstraint(["destination_id"], ["app.destinations.id"]),
        sa.ForeignKeyConstraint(["approved_by"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "knowledge_chunks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("document_id", UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("embedding_model", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["app.knowledge_documents.id"]),
        schema="app",
    )

    op.create_table(
        "recommendation_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("trip_version_id", UUID(as_uuid=True)),
        sa.Column("user_id", UUID(as_uuid=True)),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("prompt_version", sa.Text(), nullable=False),
        sa.Column("ranker_version", sa.Text(), nullable=False),
        sa.Column("optimizer_version", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("constraints", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("validation", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["trip_version_id"], ["app.trip_versions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "recommendation_candidates",
        sa.Column("run_id", UUID(as_uuid=True), nullable=False),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("eligible", sa.Boolean(), nullable=False),
        sa.Column("sponsored", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reasons", sa.JSON(), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("run_id", "experience_id", name="pk_recommendation_candidates"),
        sa.ForeignKeyConstraint(["run_id"], ["app.recommendation_runs.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "retrieval_sources",
        sa.Column("run_id", UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_id", UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("run_id", "chunk_id", name="pk_retrieval_sources"),
        sa.ForeignKeyConstraint(["run_id"], ["app.recommendation_runs.id"]),
        sa.ForeignKeyConstraint(["chunk_id"], ["app.knowledge_chunks.id"]),
        schema="app",
    )

    op.create_table(
        "feedback_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("user_id", UUID(as_uuid=True)),
        sa.Column("run_id", UUID(as_uuid=True)),
        sa.Column("original_version_id", UUID(as_uuid=True)),
        sa.Column("final_version_id", UUID(as_uuid=True)),
        sa.Column("booking_id", UUID(as_uuid=True)),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("training_consent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["run_id"], ["app.recommendation_runs.id"]),
        sa.ForeignKeyConstraint(["original_version_id"], ["app.trip_versions.id"]),
        sa.ForeignKeyConstraint(["final_version_id"], ["app.trip_versions.id"]),
        sa.ForeignKeyConstraint(["booking_id"], ["app.bookings.id"]),
        schema="app",
    )

    op.create_table(
        "evaluation_datasets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("checksum", sa.Text(), nullable=False),
        sa.Column("sealed_at", sa.DateTime(timezone=True)),
        schema="app",
    )

    op.create_table(
        "evaluation_cases",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("dataset_id", UUID(as_uuid=True), nullable=False),
        sa.Column("locale", sa.Text(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("expected_constraints", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("fixture_version", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["app.evaluation_datasets.id"]),
        schema="app",
    )

    op.create_table(
        "evaluation_runs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("dataset_id", UUID(as_uuid=True), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("prompt_version", sa.Text(), nullable=False),
        sa.Column("ranker_version", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["dataset_id"], ["app.evaluation_datasets.id"]),
        schema="app",
    )

    op.create_table(
        "evaluation_results",
        sa.Column("run_id", UUID(as_uuid=True), nullable=False),
        sa.Column("case_id", UUID(as_uuid=True), nullable=False),
        sa.Column("passed", sa.Boolean(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("run_id", "case_id", name="pk_evaluation_results"),
        sa.ForeignKeyConstraint(["run_id"], ["app.evaluation_runs.id"]),
        sa.ForeignKeyConstraint(["case_id"], ["app.evaluation_cases.id"]),
        schema="app",
    )

    op.create_table(
        "weather_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("venue_id", UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("forecast_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("measurements", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("attribution", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["venue_id"], ["app.venues.id"]),
        schema="app",
    )

    op.create_table(
        "weather_warnings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("trip_stop_id", UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rule_version", sa.Text(), nullable=False),
        sa.Column("severity", sa.Text(), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["trip_stop_id"], ["app.trip_stops.id"]),
        sa.ForeignKeyConstraint(["snapshot_id"], ["app.weather_snapshots.id"]),
        schema="app",
    )

    op.create_table(
        "configuration_versions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("value", sa.JSON(), nullable=False),
        sa.Column("changed_by", UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["changed_by"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "commission_terms",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("organization_id", UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("basis_points", sa.Integer(), nullable=False),
        sa.Column("fixed_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["app.organizations.id"]),
        sa.ForeignKeyConstraint(["currency"], ["app.currencies(code"]),
        schema="app",
    )

    op.create_table(
        "booking_commissions",
        sa.Column("booking_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("terms_id", UUID(as_uuid=True), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["booking_id"], ["app.bookings.id"]),
        sa.ForeignKeyConstraint(["terms_id"], ["app.commission_terms.id"]),
        schema="app",
    )

    op.create_table(
        "analytics_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("event_name", sa.Text(), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True)),
        sa.Column("organization_id", UUID(as_uuid=True)),
        sa.Column("experience_id", UUID(as_uuid=True)),
        sa.Column("properties", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("dedupe_key", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["app.users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["app.organizations.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "data_quality_issues",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.Column("rule_code", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.Column("details", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )

    op.create_table(
        "audit_log",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("actor_id", UUID(as_uuid=True)),
        sa.Column("request_id", sa.Text()),
        sa.Column("action", sa.Text(), nullable=False),
        sa.Column("table_name", sa.Text(), nullable=False),
        sa.Column("row_key", sa.JSON(), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=False),
        sa.Column("reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["app.users.id"]),
        schema="app",
    )

    op.create_table(
        "trip_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.func.gen_random_uuid()),
        sa.Column("slug", sa.Text(), nullable=False, unique=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("destination_id", UUID(as_uuid=True)),
        sa.Column("description", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["destination_id"], ["app.destinations.id"]),
        schema="app",
    )

    op.create_table(
        "trip_template_stops",
        sa.Column("template_id", UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("experience_id", UUID(as_uuid=True), nullable=False),
        sa.PrimaryKeyConstraint("template_id", "position", name="pk_trip_template_stops"),
        sa.ForeignKeyConstraint(["template_id"], ["app.trip_templates.id"]),
        sa.ForeignKeyConstraint(["experience_id"], ["app.experiences.id"]),
        schema="app",
    )


def downgrade() -> None:
    op.drop_table("trip_template_stops", schema="app")
    op.drop_table("trip_templates", schema="app")
    op.drop_table("audit_log", schema="app")
    op.drop_table("data_quality_issues", schema="app")
    op.drop_table("analytics_events", schema="app")
    op.drop_table("booking_commissions", schema="app")
    op.drop_table("commission_terms", schema="app")
    op.drop_table("configuration_versions", schema="app")
    op.drop_table("weather_warnings", schema="app")
    op.drop_table("weather_snapshots", schema="app")
    op.drop_table("evaluation_results", schema="app")
    op.drop_table("evaluation_runs", schema="app")
    op.drop_table("evaluation_cases", schema="app")
    op.drop_table("evaluation_datasets", schema="app")
    op.drop_table("feedback_events", schema="app")
    op.drop_table("retrieval_sources", schema="app")
    op.drop_table("recommendation_candidates", schema="app")
    op.drop_table("recommendation_runs", schema="app")
    op.drop_table("knowledge_chunks", schema="app")
    op.drop_table("knowledge_documents", schema="app")
