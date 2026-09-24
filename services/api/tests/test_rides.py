"""V3: booking a verified driver.

Requests reach only live drivers who cover the area; prices are fixed up
front; the accepted driver's plate and verified phone reach the traveller;
family get a share link; reviews are blind; reports escalate; suspension
cancels what is booked; and open requests expire.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.partners_support import client, live_driver
from tests.test_guide_tours import _register


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"driver": client(), "admin": client(), "traveller": client(), "anon": client(), "other": client()}
    try:
        yield made
    finally:
        for each in made.values():
            await each.aclose()


def _ask(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "kind": "ride",
        "destination": "byblos",
        "pickup_name": "Byblos Old Souk",
        "pickup_lat": 34.1213,
        "pickup_lng": 35.6475,
        "dropoff_name": "Batroun seafront",
        "starts_at": (datetime.now(UTC) + timedelta(days=2)).isoformat(),
        "party_size": 3,
        "luggage": 2,
    }
    body.update(overrides)
    return body


async def _past(request_id: str) -> None:
    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.ride_requests SET starts_at = now() - interval '2 hours' WHERE id = CAST(:id AS uuid)"),
            {"id": request_id},
        )
        await session.commit()


async def _book(traveller: AsyncClient, driver: AsyncClient, vehicle_id: str, **ask: Any) -> dict[str, Any]:
    asked = await traveller.post("/api/v1/rides/requests", json=_ask(**ask))
    assert asked.status_code == 200, asked.text
    quoted = await driver.post(
        f"/api/v1/rides/driver/requests/{asked.json()['id']}/quote",
        json={"vehicle_id": vehicle_id, "price_minor": 2500, "note": "Air conditioning, water on board"},
    )
    assert quoted.status_code == 200, quoted.text
    request = (await traveller.get(f"/api/v1/rides/requests/{asked.json()['id']}")).json()
    accepted = await traveller.post(f"/api/v1/rides/quotes/{request['quotes'][0]['id']}/accept")
    assert accepted.status_code == 200, accepted.text
    return dict(accepted.json())


@pytest.mark.asyncio
async def test_a_traveller_books_a_live_driver_at_a_fixed_price(clients: dict[str, AsyncClient]) -> None:
    driver, admin, traveller, anon = clients["driver"], clients["admin"], clients["traveller"], clients["anon"]
    profile = await live_driver(driver, admin, regions=["byblos"])
    vehicle_id = profile["vehicles"][0]["id"]
    set_terms = await driver.put("/api/v1/rides/driver/terms", json={"day_rate_minor": 12000, "airport_pickups": False})
    assert set_terms.status_code == 200 and set_terms.json()["day_rate_minor"] == 12000
    listed = (await anon.get("/api/v1/rides/drivers?destination=byblos")).json()
    assert any(item["slug"] == profile["slug"] for item in listed)
    assert all(
        item["slug"] != profile["slug"] for item in (await anon.get("/api/v1/rides/drivers?destination=tyre")).json()
    )

    me = await _register(traveller, "rider")
    assert (await anon.post("/api/v1/rides/requests", json=_ask())).status_code == 401
    soon = await traveller.post("/api/v1/rides/requests", json=_ask(starts_at=datetime.now(UTC).isoformat()))
    assert soon.status_code == 422 and "an hour" in soon.text
    no_flight = await traveller.post("/api/v1/rides/requests", json=_ask(kind="airport"))
    assert no_flight.status_code == 422 and "flight" in no_flight.text
    no_drop = await traveller.post("/api/v1/rides/requests", json=_ask(dropoff_name=""))
    assert no_drop.status_code == 422

    asked = (await traveller.post("/api/v1/rides/requests", json=_ask())).json()
    assert asked["status"] == "open" and asked["quotes"] == []
    airport = (await traveller.post("/api/v1/rides/requests", json=_ask(kind="airport", flight_number="me 202"))).json()
    assert airport["flight_number"] == "ME 202"
    inbox = (await driver.get("/api/v1/rides/driver/requests")).json()
    ids = [item["id"] for item in inbox]
    assert asked["id"] in ids and airport["id"] not in ids, "this driver does not do airport pickups"
    assert "quotes" not in inbox[0] and "trip_id" not in inbox[0] or inbox[0]["trip_id"] is None
    async with TestingSessionLocal() as session:
        pinged = (
            await session.execute(
                text(
                    "SELECT count(*) FROM app.outbox WHERE event_type = 'ride.requested' AND aggregate_id = CAST(:id AS uuid)"
                ),
                {"id": asked["id"]},
            )
        ).scalar_one()
    assert pinged >= 1

    too_cheap = await driver.post(
        f"/api/v1/rides/driver/requests/{asked['id']}/quote", json={"vehicle_id": vehicle_id, "price_minor": 50}
    )
    assert too_cheap.status_code == 422
    quoted = await driver.post(
        f"/api/v1/rides/driver/requests/{asked['id']}/quote",
        json={"vehicle_id": vehicle_id, "price_minor": 3000, "note": "Can stop at the citadel"},
    )
    assert quoted.status_code == 200 and quoted.json()["my_quote"]["price_minor"] == 3000
    request = (await traveller.get(f"/api/v1/rides/requests/{asked['id']}")).json()
    offer = request["quotes"][0]
    assert offer["driver"]["slug"] == profile["slug"] and offer["driver"]["photo_url"]
    assert offer["vehicle"]["plate"] == profile["vehicles"][0]["plate"]
    assert "photo" not in offer["driver"] and "documents" not in offer["driver"]
    assert (await clients["other"].get(f"/api/v1/rides/requests/{asked['id']}")).status_code == 401

    accepted = await traveller.post(f"/api/v1/rides/quotes/{offer['id']}/accept")
    assert accepted.status_code == 200, accepted.text
    ride = accepted.json()
    assert ride["state"] == "confirmed" and ride["price_minor"] == 3000
    assert ride["driver_phone"] and ride["driver_phone"].startswith("+961")
    token = ride["share_token"]
    again = await traveller.post(f"/api/v1/rides/quotes/{offer['id']}/accept")
    assert again.status_code == 422

    shared = await anon.get(f"/api/v1/rides/shared/{token}")
    assert shared.status_code == 200, shared.text
    assert shared.json()["vehicle"]["plate"] == offer["vehicle"]["plate"] and "driver_phone" not in shared.json()
    assert (await anon.get("/api/v1/rides/shared/not-a-real-token-at-all")).status_code == 404
    rotated = (await traveller.post(f"/api/v1/rides/{ride['id']}/share")).json()["share_token"]
    assert (await anon.get(f"/api/v1/rides/shared/{token}")).status_code == 404, "the old link stops working"
    assert (await anon.get(f"/api/v1/rides/shared/{rotated}")).status_code == 200

    driver_view = (await driver.get(f"/api/v1/rides/{ride['id']}")).json()
    assert driver_view["viewer"] == "driver" and driver_view["traveller"]["display_name"] == me["display_name"]
    outsider = clients["other"]
    await _register(outsider, "outsider")
    assert (await outsider.get(f"/api/v1/rides/{ride['id']}")).status_code == 404
    assert (
        await outsider.post(
            "/api/v1/rides/reports",
            json={"ride_id": ride["id"], "category": "safety", "details": "I was not in this ride at all"},
        )
    ).status_code == 404

    early = await driver.post(f"/api/v1/rides/{ride['id']}/finish", json={"outcome": "completed"})
    assert early.status_code == 422
    await _past(asked["id"])
    done = await driver.post(f"/api/v1/rides/{ride['id']}/finish", json={"outcome": "completed"})
    assert done.status_code == 200 and done.json()["state"] == "completed"
    assert (await traveller.get(f"/api/v1/rides/{ride['id']}")).json().get("driver_phone") is None

    mine = await traveller.post(f"/api/v1/rides/{ride['id']}/review", json={"rating": 5, "body": "Careful driver"})
    assert mine.status_code == 200
    assert (await driver.get(f"/api/v1/rides/{ride['id']}")).json()["reviews"]["theirs"] is None, "blind until both"
    assert (await traveller.post(f"/api/v1/rides/{ride['id']}/review", json={"rating": 4})).status_code == 422
    await driver.post(f"/api/v1/rides/{ride['id']}/review", json={"rating": 5, "body": "On time"})
    assert (await driver.get(f"/api/v1/rides/{ride['id']}")).json()["reviews"]["theirs"]["rating"] == 5
    page = (await anon.get(f"/api/v1/rides/drivers/{profile['slug']}")).json()
    assert page["rating"]["average"] == 5.0 and page["reviews"][0]["body"] == "Careful driver"
    assert page["rating"]["completed_rides"] == 1

    reported = await traveller.post(
        "/api/v1/rides/reports",
        json={"ride_id": ride["id"], "category": "wrong_plate", "details": "The plate did not match the app"},
    )
    assert reported.status_code == 200 and reported.json()["escalated"] is True
    fare = await traveller.post(
        "/api/v1/rides/reports",
        json={"ride_id": ride["id"], "category": "overcharge", "details": "Asked for more than the quote"},
    )
    assert fare.json()["escalated"] is False
    history = (await traveller.get("/api/v1/rides/mine")).json()
    assert [item["id"] for item in history["rides"]] == [ride["id"]]


@pytest.mark.asyncio
async def test_suspending_a_driver_cancels_booked_rides_and_lapsed_drivers_cannot_quote(
    clients: dict[str, AsyncClient],
) -> None:
    driver, admin, traveller, anon = clients["driver"], clients["admin"], clients["traveller"], clients["anon"]
    profile = await live_driver(driver, admin, regions=["byblos"])
    vehicle_id = profile["vehicles"][0]["id"]
    await _register(traveller, "booked")
    ride = await _book(traveller, driver, vehicle_id)
    waiting = (await traveller.post("/api/v1/rides/requests", json=_ask(party_size=2))).json()
    await driver.post(
        f"/api/v1/rides/driver/requests/{waiting['id']}/quote", json={"vehicle_id": vehicle_id, "price_minor": 2000}
    )

    cancel_no_reason = await driver.post(f"/api/v1/rides/{ride['id']}/cancel", json={"reason": ""})
    assert cancel_no_reason.status_code == 422, "a driver must say why"

    await admin.post(
        f"/api/v1/admin/partners/{profile['id']}", json={"decision": "suspended", "reason": "Two safety reports"}
    )
    after = (await traveller.get(f"/api/v1/rides/{ride['id']}")).json()
    assert after["state"] == "cancelled_by_driver"
    offered = (await traveller.get(f"/api/v1/rides/requests/{waiting['id']}")).json()
    assert offered["quotes"] == [], "their quotes are withdrawn"
    assert (await anon.get(f"/api/v1/rides/drivers/{profile['slug']}")).status_code == 404
    async with TestingSessionLocal() as session:
        told = (
            await session.execute(
                text(
                    "SELECT count(*) FROM app.outbox WHERE event_type = 'ride.cancelled' AND aggregate_id = CAST(:id AS uuid)"
                ),
                {"id": ride["id"]},
            )
        ).scalar_one()
    assert told >= 1
    assert (await driver.get("/api/v1/rides/driver/requests")).json() == []
    blocked = await driver.post(
        f"/api/v1/rides/driver/requests/{waiting['id']}/quote", json={"vehicle_id": vehicle_id, "price_minor": 2000}
    )
    assert blocked.status_code == 422 and "not live" in blocked.text

    # A traveller cancels their own open request; the sweep expires the rest.
    cancelled = await traveller.post(f"/api/v1/rides/requests/{waiting['id']}/cancel")
    assert cancelled.json()["status"] == "cancelled"
    stale = (await traveller.post("/api/v1/rides/requests", json=_ask())).json()
    async with TestingSessionLocal() as session:
        await session.execute(
            text("UPDATE app.ride_requests SET expires_at = now() - interval '1 minute' WHERE id = CAST(:id AS uuid)"),
            {"id": stale["id"]},
        )
        await session.commit()
    swept = (await anon.post("/api/v1/partners/ops/sweep", headers={"X-Job-Token": settings.job_token})).json()
    assert swept["rides"]["requests_expired"] >= 1
    assert (await traveller.get(f"/api/v1/rides/requests/{stale['id']}")).json()["status"] == "expired"
