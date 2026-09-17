"""Database-level guarantees added in migration 022."""

from __future__ import annotations

import os

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from tests.conftest import TestingSessionLocal
from tests.test_booking_payments import _grant_admin, _published_listing, _traveller, api  # noqa: F401


@pytest.mark.asyncio
async def test_no_app_function_is_executable_by_public() -> None:
    async with TestingSessionLocal() as session:
        count = (
            await session.execute(
                text(
                    """
                    SELECT count(*)
                    FROM pg_proc p
                    JOIN pg_namespace n ON n.oid = p.pronamespace,
                    LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                    WHERE n.nspname = 'app' AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
                    """
                )
            )
        ).scalar_one()
    assert count == 0


@pytest.mark.asyncio
async def test_every_app_table_has_row_level_security() -> None:
    # notification_templates was missing it before migration 024 (review finding SR-06).
    async with TestingSessionLocal() as session:
        missing = (
            (
                await session.execute(
                    text(
                        """
                        SELECT c.relname
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE n.nspname = 'app' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
                        ORDER BY 1
                        """
                    )
                )
            )
            .scalars()
            .all()
        )
    assert missing == []


@pytest.mark.asyncio
async def test_expired_price_rules_are_not_shown(api: AsyncClient) -> None:  # noqa: F811
    catalog = await _published_listing(api, mode="request")
    experience_id = catalog["listing"]["id"]
    async with TestingSessionLocal() as session:
        current = (
            await session.execute(text("SELECT count(*) FROM app.current_price_rule(:id)"), {"id": experience_id})
        ).scalar_one()
        assert current == 1
        await session.execute(
            text(
                "UPDATE app.price_rules SET valid_during = tstzrange('2000-01-01', '2001-01-01', '[)') "
                "WHERE experience_id = :id"
            ),
            {"id": experience_id},
        )
        expired = (
            await session.execute(text("SELECT count(*) FROM app.current_price_rule(:id)"), {"id": experience_id})
        ).scalar_one()
        await session.rollback()
    assert expired == 0


@pytest.mark.asyncio
async def test_range_prices_need_an_upper_bound() -> None:
    async with TestingSessionLocal() as session:
        with pytest.raises(Exception, match="price_rules_range_has_max_check"):  # noqa: B017
            await session.execute(
                text("UPDATE app.price_rules SET price_type = 'range', max_amount_minor = NULL WHERE amount_minor > 0")
            )
        await session.rollback()


@pytest.mark.asyncio
async def test_admin_booking_list_is_paged(api: AsyncClient) -> None:  # noqa: F811
    admin = await _traveller(api)
    await _grant_admin(admin["id"])
    first = await api.get("/api/v1/admin/bookings", params={"limit": 1})
    assert first.status_code == 200, first.text
    assert len(first.json()) <= 1
    too_big = await api.get("/api/v1/admin/bookings", params={"limit": 501})
    assert too_big.status_code == 422


@pytest.mark.asyncio
async def test_api_connection_role_is_reported(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import db_role
    from app.dependencies import engine

    privileges = await db_role.check_database_role(engine)
    assert set(privileges) >= {"role", "superuser", "bypass_rls", "backend_member"}
    if os.environ.get("TEST_ADMIN_DATABASE_URL"):
        # CI runs the API as mshwar_api: production-shaped, so this must pass cleanly.
        assert db_role.problems_with(privileges) == []
    monkeypatch.setattr(db_role.settings, "environment", "production")
    if db_role.problems_with(privileges):
        with pytest.raises(db_role.UnsafeDatabaseRole):
            await db_role.check_database_role(engine)


def test_unsafe_database_roles_are_named() -> None:
    from app.core.db_role import problems_with

    assert problems_with({"superuser": True, "bypass_rls": True, "backend_member": False}) == [
        "is a superuser",
        "has BYPASSRLS",
        "is not a member of mshwar_backend",
    ]
    assert problems_with({"superuser": False, "bypass_rls": False, "backend_member": True}) == []
