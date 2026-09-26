"""A plan is kept in "My trips" only when the traveller saves it and confirms (migration 057)."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from tests.test_planner_api import _register


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


async def _trip_ids(api: AsyncClient) -> set[str]:
    listed = await api.get("/api/v1/trips")
    assert listed.status_code == 200, listed.text
    return {item["id"] for item in listed.json()["items"]}


@pytest.mark.asyncio
async def test_a_plan_is_kept_only_after_it_is_saved(api: AsyncClient) -> None:
    await _register(api, "save")
    created = await api.post("/api/v1/planner/sessions", json={"text": "a slow day in Byblos for two", "locale": "en"})
    assert created.status_code == 200, created.text
    trip_id = created.json()["plan"]["trip_id"]

    assert (await api.get(f"/api/v1/planner/trips/{trip_id}/saved")).json()["saved"] is False
    assert trip_id not in await _trip_ids(api), "a plan the traveller only tried is not in My trips"

    saved = await api.post(f"/api/v1/planner/trips/{trip_id}/save", json={"name": "Byblos with Lina"})
    assert saved.status_code == 200, saved.text
    assert saved.json()["saved"] is True and saved.json()["saved_at"]
    trips = (await api.get("/api/v1/trips")).json()["items"]
    mine = next(item for item in trips if item["id"] == trip_id)
    assert mine["name"] == "Byblos with Lina"

    again = await api.post(f"/api/v1/planner/trips/{trip_id}/save", json={})
    assert again.json()["saved_at"] == saved.json()["saved_at"], "saving twice keeps the first date"
    assert (await api.post(f"/api/v1/planner/trips/{trip_id}/save", json={"name": "x" * 121})).status_code == 422


@pytest.mark.asyncio
async def test_a_trip_made_by_hand_is_saved_and_others_cannot_save_mine(api: AsyncClient) -> None:
    await _register(api, "owner")
    created = await api.post("/api/v1/planner/sessions", json={"text": "a slow day in Byblos for two", "locale": "en"})
    trip_id = created.json()["plan"]["trip_id"]
    drafted = await api.post("/api/v1/trips", json={"name": f"By hand {uuid4().hex[:6]}"})
    assert drafted.status_code in (200, 201), drafted.text
    assert drafted.json()["id"] in await _trip_ids(api), "a trip the traveller creates is kept"

    await _register(api, "stranger")
    assert (await api.post(f"/api/v1/planner/trips/{trip_id}/save", json={})).status_code == 404
    assert (await api.get(f"/api/v1/planner/trips/{trip_id}/saved")).status_code == 404
