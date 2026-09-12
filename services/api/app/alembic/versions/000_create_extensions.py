"""Alembic migration 000: Create required PostgreSQL extensions.

Creates postgis (geospatial), pgvector (vector similarity), and btree_gist
(exclusion constraints for slot booking) extensions.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision = "000"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgvector")
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS btree_gist")
    op.execute("DROP EXTENSION IF EXISTS pgvector")
    op.execute("DROP EXTENSION IF EXISTS postgis")
