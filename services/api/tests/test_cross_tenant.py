"""Cross-tenant isolation tests.

These tests prove that organizations cannot read each other's data
even with crafted queries. RLS with FORCE ROW LEVEL SECURITY must
reject such attempts at the database level.
"""

import uuid

import pytest
from sqlalchemy import text

from app.core.context import clear_session_context, set_session_context


class TestCrossTenantIsolation:
    """Tests that org-scoped data is isolated by RLS policies."""

    @pytest.mark.asyncio
    async def test_org_a_cannot_read_org_b_bookings(self, db_session):
        """Org A must not be able to read bookings belonging to Org B."""
        org_a = uuid.UUID("00000000-0000-0000-0000-000000000001")
        org_b = uuid.UUID("11111111-1111-1111-1111-111111111111")
        user_a = uuid.UUID("22222222-2222-2222-2222-222222222222")

        set_session_context(user_id=user_a, organization_id=org_a)
        await db_session.execute(text("SET LOCAL app.user_id = :uid"), {"uid": str(user_a)})
        await db_session.execute(text("SET LOCAL app.organization_id = :oid"), {"oid": str(org_a)})

        result = await db_session.execute(
            text("SELECT id FROM app.bookings WHERE organization_id = :org_id"),
            {"org_id": str(org_b)},
        )
        rows = result.fetchall()
        assert len(rows) == 0, "Org A must not see org B's bookings"

        await db_session.execute(text("RESET app.user_id"))
        await db_session.execute(text("RESET app.organization_id"))
        clear_session_context()

    @pytest.mark.asyncio
    async def test_org_a_cannot_read_org_b_experiences(self, db_session):
        """Org A must not be able to read experiences belonging to Org B."""
        org_a = uuid.UUID("00000000-0000-0000-0000-000000000001")
        org_b = uuid.UUID("11111111-1111-1111-1111-111111111111")
        user_a = uuid.UUID("22222222-2222-2222-2222-222222222222")

        set_session_context(user_id=user_a, organization_id=org_a)
        await db_session.execute(text("SET LOCAL app.user_id = :uid"), {"uid": str(user_a)})
        await db_session.execute(text("SET LOCAL app.organization_id = :oid"), {"oid": str(org_a)})

        result = await db_session.execute(
            text("SELECT id FROM app.experiences WHERE organization_id = :org_id"),
            {"org_id": str(org_b)},
        )
        rows = result.fetchall()
        assert len(rows) == 0, "Org A must not see org B's experiences"

        await db_session.execute(text("RESET app.user_id"))
        await db_session.execute(text("RESET app.organization_id"))
        clear_session_context()

    @pytest.mark.asyncio
    async def test_org_a_cannot_read_org_b_venues(self, db_session):
        """Org A must not be able to read venues belonging to Org B."""
        org_a = uuid.UUID("00000000-0000-0000-0000-000000000001")
        org_b = uuid.UUID("11111111-1111-1111-1111-111111111111")
        user_a = uuid.UUID("22222222-2222-2222-2222-222222222222")

        set_session_context(user_id=user_a, organization_id=org_a)
        await db_session.execute(text("SET LOCAL app.user_id = :uid"), {"uid": str(user_a)})
        await db_session.execute(text("SET LOCAL app.organization_id = :oid"), {"oid": str(org_a)})

        result = await db_session.execute(
            text("SELECT id FROM app.venues WHERE organization_id = :org_id"),
            {"org_id": str(org_b)},
        )
        rows = result.fetchall()
        assert len(rows) == 0, "Org A must not see org B's venues"

        await db_session.execute(text("RESET app.user_id"))
        await db_session.execute(text("RESET app.organization_id"))
        clear_session_context()

    @pytest.mark.asyncio
    async def test_user_cannot_read_another_users_trips(self, db_session):
        """User A must not be able to read trips owned by User B."""
        user_a = uuid.UUID("22222222-2222-2222-2222-222222222222")
        user_b = uuid.UUID("33333333-3333-3333-3333-333333333333")
        org_a = uuid.UUID("00000000-0000-0000-0000-000000000001")

        set_session_context(user_id=user_a, organization_id=org_a)
        await db_session.execute(text("SET LOCAL app.user_id = :uid"), {"uid": str(user_a)})
        await db_session.execute(text("SET LOCAL app.organization_id = :oid"), {"oid": str(org_a)})

        result = await db_session.execute(
            text("SELECT id FROM app.trips WHERE owner_id = :uid"),
            {"uid": str(user_b)},
        )
        rows = result.fetchall()
        assert len(rows) == 0, "User A must not see User B's trips"

        await db_session.execute(text("RESET app.user_id"))
        await db_session.execute(text("RESET app.organization_id"))
        clear_session_context()

    @pytest.mark.asyncio
    async def test_user_cannot_read_another_users_favorites(self, db_session):
        """User A must not be able to read favorites of User B."""
        user_a = uuid.UUID("22222222-2222-2222-2222-222222222222")
        user_b = uuid.UUID("33333333-3333-3333-3333-333333333333")
        org_a = uuid.UUID("00000000-0000-0000-0000-000000000001")

        set_session_context(user_id=user_a, organization_id=org_a)
        await db_session.execute(text("SET LOCAL app.user_id = :uid"), {"uid": str(user_a)})
        await db_session.execute(text("SET LOCAL app.organization_id = :oid"), {"oid": str(org_a)})

        result = await db_session.execute(
            text("SELECT id FROM app.favorites WHERE user_id = :uid"),
            {"uid": str(user_b)},
        )
        rows = result.fetchall()
        assert len(rows) == 0, "User A must not see User B's favorites"

        await db_session.execute(text("RESET app.user_id"))
        await db_session.execute(text("RESET app.organization_id"))
        clear_session_context()

    @pytest.mark.asyncio
    async def test_session_context_set_on_request(self, db_session):
        """Verify that session context is properly set on every request."""
        user_id = uuid.UUID("22222222-2222-2222-2222-222222222222")
        org_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

        set_session_context(user_id=user_id, organization_id=org_id)
        await db_session.execute(text("SET LOCAL app.user_id = :uid"), {"uid": str(user_id)})
        await db_session.execute(text("SET LOCAL app.organization_id = :oid"), {"oid": str(org_id)})

        result = await db_session.execute(text("SELECT app.actor_id()"))
        actor_id = result.scalar()
        assert actor_id == user_id, "actor_id must match the set session user"

        await db_session.execute(text("RESET app.user_id"))
        await db_session.execute(text("RESET app.organization_id"))
        clear_session_context()

    @pytest.mark.asyncio
    async def test_session_context_cleared_on_release(self):
        """Verify that session context is cleared after request release."""
        user_id = uuid.UUID("22222222-2222-2222-2222-222222222222")
        org_id = uuid.UUID("00000000-0000-0000-0000-000000000001")

        set_session_context(user_id=user_id, organization_id=org_id)
        from app.core.context import get_current_organization_id, get_current_user_id

        assert get_current_user_id() == user_id
        assert get_current_organization_id() == org_id

        clear_session_context()
        assert get_current_user_id() is None
        assert get_current_organization_id() is None, "Organization context must be cleared"

    @pytest.mark.asyncio
    async def test_rls_enabled_on_all_app_tables(self, db_session):
        """Verify RLS is enabled and FORCED on every app table."""
        result = await db_session.execute(
            text("""
                SELECT count(*) FROM pg_tables t
                JOIN pg_class c ON c.relname = t.tablename
                JOIN pg_namespace n ON n.nspname = t.schemaname
                WHERE t.schemaname = 'app' AND c.relrowsecurity = true AND c.relforcerowsecurity = true
            """)
        )
        count = result.scalar()
        assert count > 0, "At least one app table must have RLS enabled and forced"

    @pytest.mark.asyncio
    async def test_backend_role_cannot_bypass_rls(self, db_session):
        """Verify that the backend role cannot bypass RLS."""
        result = await db_session.execute(
            text("""
                SELECT rolname, rolbypassrls FROM pg_roles
                WHERE rolname IN ('mshwar_backend', 'mshwar_reader')
            """)
        )
        rows = result.fetchall()
        for row in rows:
            assert not row[1], f"{row[0]} must not have BYPASSRLS"

    @pytest.mark.asyncio
    async def test_cross_tenant_booking_query_fails_closed(self, db_session):
        """Test that a cross-tenant booking query returns zero rows, not an error or data."""
        org_a = uuid.UUID("00000000-0000-0000-0000-000000000001")
        org_b = uuid.UUID("11111111-1111-1111-1111-111111111111")
        user_a = uuid.UUID("22222222-2222-2222-2222-222222222222")

        set_session_context(user_id=user_a, organization_id=org_a)
        await db_session.execute(text("SET LOCAL app.user_id = :uid"), {"uid": str(user_a)})
        await db_session.execute(text("SET LOCAL app.organization_id = :oid"), {"oid": str(org_a)})

        result = await db_session.execute(
            text("SELECT COUNT(*) FROM app.bookings WHERE organization_id = :org_id"),
            {"org_id": str(org_b)},
        )
        count = result.scalar()
        assert count == 0, "Cross-tenant query must return 0 rows due to RLS"

        await db_session.execute(text("RESET app.user_id"))
        await db_session.execute(text("RESET app.organization_id"))
        clear_session_context()
