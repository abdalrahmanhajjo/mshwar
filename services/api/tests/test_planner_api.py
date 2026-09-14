from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.rate_limit import limiter
from app.main import app
from app.planner.routing import RouteLeg, RoutingCost, persist_cost, persist_leg, read_persisted_leg, reset_memory_cache
from app.planner.weather import Forecast, persist_forecast
from tests.conftest import TestingSessionLocal


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    reset_memory_cache()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    reset_memory_cache()


async def _register(api: AsyncClient) -> None:
    created = await api.post(
        "/api/v1/auth/register",
        json={
            "email": f"plan-{uuid4().hex[:10]}@example.com",
            "password": "long-enough-secret",
            "display_name": "Planner",
            "locale": "en",
        },
    )
    assert created.status_code == 201, created.text


def _window() -> tuple[str, str]:
    start = datetime(2026, 9, 14, 8, 0, tzinfo=timezone.utc)
    return start.isoformat(), (start + timedelta(hours=10)).isoformat()


@pytest.mark.asyncio
async def test_planner_routes_require_session() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as fresh:
        assert (
            await fresh.post(
                "/api/v1/planner/route",
                json={
                    "origin": {"lat": 33.89, "lng": 35.50},
                    "destination": {"lat": 34.12, "lng": 35.65},
                },
            )
        ).status_code == 401


@pytest.mark.asyncio
async def test_route_stub_cache_and_unavailable_flag(api: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    await _register(api)
    payload = {
        "origin": {"lat": 33.8938, "lng": 35.5018},
        "destination": {"lat": 34.123, "lng": 35.651},
        "mode": "driving",
        "plan_id": "cost-1",
    }
    first = await api.post("/api/v1/planner/route", json=payload)
    assert first.status_code == 200, first.text
    body = first.json()
    assert body["available"] is True
    assert body["source"] == "haversine-stub"
    assert body["presented_as"] == "stub"
    assert body["distance_m"] > 0
    second = await api.post("/api/v1/planner/route", json=payload)
    assert second.json()["cache_hit"] is True

    monkeypatch.setattr("app.core.config.settings.catalogue_routing_provider", "unavailable")
    reset_memory_cache()
    from app.planner.routing import RoutingService, UnavailableProvider

    monkeypatch.setattr(
        "app.api.v1.endpoints.planner.RoutingService", lambda: RoutingService(provider=UnavailableProvider())
    )
    down = await api.post("/api/v1/planner/route", json={**payload, "plan_id": "down"})
    assert down.status_code == 200
    missing = down.json()
    assert missing["available"] is False
    assert missing["distance_m"] is None
    assert missing["presented_as"] == "unavailable"


@pytest.mark.asyncio
async def test_optimize_and_weather_warning_do_not_mutate_bookings(api: AsyncClient) -> None:
    await _register(api)
    window_start, return_by = _window()
    plan = {
        "start": {"lat": 33.8938, "lng": 35.5018, "label": "Hamra"},
        "window_start": window_start,
        "return_by": return_by,
        "plan_id": "trip-1",
        "stops": [
            {
                "id": "downtown",
                "lat": 33.896,
                "lng": 35.506,
                "label": "Downtown",
                "duration_minutes": 40,
                "locked": True,
                "position": 1,
            },
            {
                "id": "hike",
                "lat": 34.24,
                "lng": 36.05,
                "label": "Cedars",
                "duration_minutes": 60,
                "weather_sensitivity": "weather-sensitive",
                "estimated_minor": 3000,
            },
            {
                "id": "cafe",
                "lat": 33.89,
                "lng": 35.47,
                "label": "Cafe",
                "duration_minutes": 40,
                "estimated_minor": 1200,
            },
        ],
    }
    optimized = await api.post("/api/v1/planner/optimize", json=plan)
    assert optimized.status_code == 200, optimized.text
    assert optimized.json()["feasible"] is True
    assert optimized.json()["ordered_stops"][0]["id"] == "downtown"
    assert optimized.json()["routing_cost"]["elements_requested"] >= 1

    warned = await api.post(
        "/api/v1/planner/warnings",
        json={
            "stops": [
                {
                    "id": "hike",
                    "label": "Cedars",
                    "lat": 33.89,
                    "lng": 35.50,
                    "forecast_date": "2026-09-14",
                    "weather_sensitivity": "weather-sensitive",
                }
            ],
            "booking_ids": ["bk-1"],
            "booking_statuses": {"bk-1": "confirmed"},
        },
    )
    assert warned.status_code == 200, warned.text
    warning_body = warned.json()
    assert warning_body["bookings_mutated"] is False
    assert warning_body["booking_statuses"] == {"bk-1": "confirmed"}
    if warning_body["warnings"]:
        assert warning_body["warnings"][0]["stop_id"] == "hike"
        assert warning_body["warnings"][0]["fetched_at"]

    replanned = await api.post(
        "/api/v1/planner/replan",
        json={
            "plan": plan,
            "affected_stop_ids": ["hike"],
            "candidates": [
                {
                    "id": "museum",
                    "lat": 33.895,
                    "lng": 35.505,
                    "label": "Museum",
                    "duration_minutes": 50,
                    "weather_sensitivity": "indoor",
                    "estimated_minor": 1800,
                }
            ],
            "booking_statuses": {"bk-1": "confirmed"},
        },
    )
    assert replanned.status_code == 200, replanned.text
    replan_body = replanned.json()
    assert replan_body["bookings_mutated"] is False
    assert replan_body["booking_statuses"] == {"bk-1": "confirmed"}
    assert replan_body["applied"] is True
    assert replan_body["diff"]["removed"] == ["hike"]

    weather = await api.post(
        "/api/v1/planner/weather",
        json={"lat": 33.89, "lng": 35.50, "forecast_date": "2026-09-14"},
    )
    assert weather.status_code == 200, weather.text
    assert weather.json()["source"]
    assert weather.json()["fetched_at"]

    bad_date = await api.post(
        "/api/v1/planner/weather", json={"lat": 33.89, "lng": 35.50, "forecast_date": "not-a-day"}
    )
    assert bad_date.status_code == 422

    too_soon = await api.post(
        "/api/v1/planner/optimize",
        json={**plan, "return_by": plan["window_start"]},
    )
    assert too_soon.status_code == 422

    thresholds = await api.get("/api/v1/planner/thresholds")
    assert thresholds.status_code == 200
    assert thresholds.json()


@pytest.mark.asyncio
async def test_start_location_search_pin_and_profile_persist(api: AsyncClient) -> None:
    await _register(api)
    suggestions = await api.get("/api/v1/locations/autocomplete", params={"q": "hamra"})
    assert suggestions.status_code == 200
    hits = suggestions.json()
    assert hits
    assert hits[0]["label"]
    reversed_place = await api.get("/api/v1/locations/reverse", params={"lat": 33.8969, "lng": 35.4822})
    assert reversed_place.status_code == 200
    assert "Hamra" in reversed_place.json()["label"] or reversed_place.json()["label"]
    saved = await api.post(
        "/api/v1/locations/start",
        json={"lat": 33.8969, "lng": 35.4822, "label": "Hamra, Beirut", "source": "search", "save_as_default": True},
    )
    assert saved.status_code == 200, saved.text
    start = saved.json()["preferences"]["start_location"]
    assert start["label"] == "Hamra, Beirut"
    assert start["source"] == "search"
    profile = await api.get("/api/v1/profile")
    assert profile.json()["preferences"]["start_location"]["lat"] == pytest.approx(33.8969)

    invalid = await api.post(
        "/api/v1/locations/start",
        json={"lat": 33.89, "lng": 35.48, "label": "X", "source": "telepathy"},
    )
    assert invalid.status_code == 422

    skipped = await api.post(
        "/api/v1/locations/start",
        json={"lat": 33.89, "lng": 35.48, "label": "Temp pin", "source": "pin", "save_as_default": False},
    )
    assert skipped.status_code == 200
    assert skipped.json()["preferences"]["start_location"]["label"] == "Hamra, Beirut"


@pytest.mark.asyncio
async def test_unavailable_weather_returns_no_warning(api: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    await _register(api)
    from app.planner.weather import UnavailableWeather, WeatherService

    def unavailable_weather() -> WeatherService:
        return WeatherService(provider=UnavailableWeather())

    monkeypatch.setattr("app.api.v1.endpoints.planner.WeatherService", unavailable_weather)
    monkeypatch.setattr("app.planner.warnings.WeatherService", unavailable_weather)
    response = await api.post(
        "/api/v1/planner/warnings",
        json={
            "stops": [
                {
                    "id": "hike",
                    "label": "Hike",
                    "lat": 34.24,
                    "lng": 36.05,
                    "forecast_date": "2026-09-14",
                    "weather_sensitivity": "outdoor",
                }
            ]
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["warnings"] == []
    assert body["forecast_unavailable"] is True
    assert body["bookings_mutated"] is False


@pytest.mark.asyncio
async def test_portal_weather_sensitivity_round_trip(api: AsyncClient) -> None:
    await _register(api)
    org = await api.post("/api/v1/portal/organizations", json={"name": "Cedar Co"})
    assert org.status_code == 201, org.text
    org_id = org.json()["id"]
    venue = await api.post(
        f"/api/v1/portal/organizations/{org_id}/venues",
        json={"name": "Studio", "address": "Hamra", "lng": 35.5018, "lat": 33.8938},
    )
    assert venue.status_code == 200, venue.text
    experience = await api.post(
        f"/api/v1/portal/organizations/{org_id}/experiences",
        json={
            "venue_id": venue.json()["id"],
            "title": "Garden lunch",
            "description": "Outdoor tables.",
            "duration_minutes": 60,
            "weather_sensitivity": "weather-sensitive",
            "setting": "outdoor",
            "category": "food",
            "price": {"currency": "USD", "price_type": "fixed", "unit": "person", "amount_minor": 2000},
            "policy": {"cancellation_rules": {"hours": 24}, "terms_text": "Cancel 24h before."},
        },
    )
    assert experience.status_code == 200, experience.text
    assert experience.json()["weather_sensitivity"] == "weather-sensitive"
    fetched = await api.get(f"/api/v1/portal/organizations/{org_id}/experiences/{experience.json()['id']}")
    assert fetched.json()["weather_sensitivity"] == "weather-sensitive"


@pytest.mark.asyncio
async def test_account_booking_status_untouched_by_warning_pipeline() -> None:
    async with TestingSessionLocal() as session:
        before = (await session.execute(text("SELECT count(*) FROM app.account_bookings"))).scalar()
        assert before is not None
    # Warning evaluation is in-memory; it must not write booking rows.
    from app.planner.warnings import WarningStop, evaluate_warnings

    evaluate_warnings(
        [
            WarningStop(
                id="x",
                label="x",
                lat=33.89,
                lng=35.5,
                forecast_date=datetime(2026, 9, 14, tzinfo=timezone.utc).date(),
            )
        ],
        booking_statuses={"bk": "confirmed"},
    )
    async with TestingSessionLocal() as session:
        after = (await session.execute(text("SELECT count(*) FROM app.account_bookings"))).scalar()
    assert after == before


@pytest.mark.asyncio
async def test_route_and_weather_persist_to_sql() -> None:
    now = datetime.now(timezone.utc)
    leg = RouteLeg(
        origin_lat=33.89,
        origin_lng=35.50,
        dest_lat=34.12,
        dest_lng=35.65,
        mode="driving",
        available=True,
        provider="haversine-stub",
        source="haversine-stub",
        time_bucket="untimed",
        distance_m=12000,
        duration_seconds=1100,
        fetched_at=now,
    )
    async with TestingSessionLocal() as session:
        await persist_leg(session, "planner-test-cache-key", leg)
        loaded = await read_persisted_leg(session, "planner-test-cache-key")
        missing = await read_persisted_leg(session, "planner-test-missing")
        await persist_cost(
            session,
            RoutingCost(plan_id="persist", provider="haversine-stub", elements_requested=1, cache_misses=1),
        )
        await persist_forecast(
            session,
            Forecast(
                available=True,
                provider="open-meteo",
                source="open-meteo",
                forecast_date=date(2026, 9, 14),
                lat=33.89,
                lng=35.50,
                fetched_at=now,
                precip_mm=1.0,
                attribution="test",
            ),
        )
        await session.commit()
    assert missing is None
    assert loaded is not None
    assert loaded.distance_m == 12000
    assert loaded.cache_hit is True


@pytest.mark.asyncio
async def test_admin_weather_thresholds_require_platform_admin(api: AsyncClient) -> None:
    await _register(api)
    listed = await api.get("/api/v1/admin/weather-thresholds")
    assert listed.status_code == 403
    denied = await api.put("/api/v1/admin/weather-thresholds", json={"key": "precip_mm", "value_numeric": 6})
    assert denied.status_code == 403

    me = await api.get("/api/v1/auth/me")
    user_id = me.json()["id"]
    async with TestingSessionLocal() as session:
        await session.execute(
            text("SELECT app.grant_platform_admin(:user_id, NULL, :tier)"),
            {"user_id": user_id, "tier": "ops"},
        )
        await session.commit()
    updated = await api.put("/api/v1/admin/weather-thresholds", json={"key": "precip_mm", "value_numeric": 6})
    assert updated.status_code == 200, updated.text
    rows = updated.json()
    precip = next(row for row in rows if row["key"] == "precip_mm")
    assert float(precip["value_numeric"]) == 6

    sensitivity = await api.post(
        "/api/v1/admin/experiences/00000000-0000-0000-0000-000000000001/weather-sensitivity",
        json={"weather_sensitivity": "indoor", "organization_id": "00000000-0000-0000-0000-000000000001"},
    )
    assert sensitivity.status_code in {404, 422, 403}
