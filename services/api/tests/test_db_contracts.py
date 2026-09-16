"""Database-level guarantees added in migration 022."""

from __future__ import annotations

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
