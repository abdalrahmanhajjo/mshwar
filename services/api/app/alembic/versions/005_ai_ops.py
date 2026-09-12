"""Migration 005: AI and Ops tables (knowledge_documents, recommendation_events, feedback_events, notifications, audit_logs).

Creates the AI/ML event tracking and operational audit tables.
Re-runnable: Drops and recreates tables.
"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_id", sa.String(255), nullable=False),
        sa.Column("embedding_vector", sa.Text(), nullable=True),
        sa.Column("business_id", sa.Integer(), sa.ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Index("ix_knowledge_documents_source_type", "knowledge_documents", ["source_type"]),
        sa.Index("ix_knowledge_documents_business_id", "knowledge_documents", ["business_id"]),
        sa.Index("ix_knowledge_documents_verified", "knowledge_documents", ["verified"]),
    )

    op.create_table(
        "recommendation_events",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("model_version", sa.String(50), nullable=False),
        sa.Column("candidate_ids", sa.Text(), nullable=False),
        sa.Column("recommendation_order", sa.Text(), nullable=False),
        sa.Column("ranking_scores", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Index("ix_recommendation_events_trip_id", "recommendation_events", ["trip_id"]),
        sa.Index("ix_recommendation_events_user_id", "recommendation_events", ["user_id"]),
    )

    op.create_table(
        "feedback_events",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("trip_id", sa.Integer(), sa.ForeignKey("trips.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("original_recommendation", sa.Text(), nullable=True),
        sa.Column("user_modification", sa.Text(), nullable=True),
        sa.Column("decision", sa.String(20), nullable=False),
        sa.Column("outcome", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Index("ix_feedback_events_trip_id", "feedback_events", ["trip_id"]),
        sa.Index("ix_feedback_events_user_id", "feedback_events", ["user_id"]),
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reference_type", sa.String(50), nullable=True),
        sa.Column("reference_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Index("ix_notifications_user_id", "notifications", ["user_id"]),
        sa.Index("ix_notifications_is_read", "notifications", ["is_read"]),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("actor_type", sa.String(20), nullable=False),
        sa.Column("actor_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", sa.Integer(), nullable=True),
        sa.Column("old_value", sa.Text(), nullable=True),
        sa.Column("new_value", sa.Text(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Index("ix_audit_logs_actor_type", "audit_logs", ["actor_type"]),
        sa.Index("ix_audit_logs_action", "audit_logs", ["action"]),
        sa.Index("ix_audit_logs_created_at", "audit_logs", ["created_at"]),
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_type", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_notifications_is_read", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_feedback_events_user_id", table_name="feedback_events")
    op.drop_index("ix_feedback_events_trip_id", table_name="feedback_events")
    op.drop_table("feedback_events")
    op.drop_index("ix_recommendation_events_user_id", table_name="recommendation_events")
    op.drop_index("ix_recommendation_events_trip_id", table_name="recommendation_events")
    op.drop_table("recommendation_events")
    op.drop_index("ix_knowledge_documents_verified", table_name="knowledge_documents")
    op.drop_index("ix_knowledge_documents_business_id", table_name="knowledge_documents")
    op.drop_index("ix_knowledge_documents_source_type", table_name="knowledge_documents")
    op.drop_table("knowledge_documents")
