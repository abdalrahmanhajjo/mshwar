"""Migration 003: Availability tables (availability_slots).

Creates time-slot inventory for experiences.
Re-runnable: Drops and recreates the table.
"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "availability_slots",
        sa.Column("id", sa.Integer(), nullable=False, primary_key=True),
        sa.Column("experience_id", sa.Integer(), sa.ForeignKey("experiences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.String(5), nullable=False),
        sa.Column("end_time", sa.String(5), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("available", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("last_updated", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="available"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("capacity >= 0", name="chk_availability_capacity"),
        sa.CheckConstraint("available <= capacity", name="chk_availability_available"),
        sa.Index("ix_availability_slots_experience_id", "availability_slots", ["experience_id"]),
        sa.Index("ix_availability_slots_date", "availability_slots", ["date"]),
        sa.UniqueConstraint("experience_id", "date", "start_time", name="uq_availability_unique_slot"),
    )


def downgrade() -> None:
    op.drop_index("uq_availability_unique_slot", table_name="availability_slots")
    op.drop_index("ix_availability_slots_date", table_name="availability_slots")
    op.drop_index("ix_availability_slots_experience_id", table_name="availability_slots")
    op.drop_table("availability_slots")
