"""No one reaches another person's guide objects by id (security plan SEC-29).

Every signed-in guide route that takes an id in its path is called by someone who does not
own the object: a second approved guide for the guide's own screens, and an unrelated
traveller for the traveller's screens. The answer must be 404 (or 403 for a route that is
simply not theirs to use), never 2xx, and never a 500: a stranger learns nothing, not even
that the object exists.

The last test fails when a new route with an id is added without a case here, so the list
cannot fall behind the code.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.api.v1.endpoints import guides as guides_endpoint
from app.core.access import route_policies
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from tests.conftest import TestingSessionLocal
from tests.media_fixtures import b64, tiny_jpeg
from tests.test_guide_after_booking import _book, _ready, _slot
from tests.test_guide_tours import _approved_guide, _client, _register

REFUSED = {403, 404}
RANDOM = "00000000-0000-4000-8000-000000000000"


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {name: _client() for name in ("guide", "admin", "traveller", "other", "other_admin", "stranger", "anon")}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


# (method, path template, body, who calls: "guide" = a second guide, "traveller" = a stranger)
CASES: list[tuple[str, str, dict[str, Any] | None, str]] = [
    ("DELETE", "/api/v1/guides/me/blocks/{block}", None, "guide"),
    ("DELETE", "/api/v1/guides/me/calendars/{calendar}", None, "guide"),
    ("DELETE", "/api/v1/guides/me/schedules/{schedule}", None, "guide"),
    ("GET", "/api/v1/guides/bookings/{booking}", None, "traveller"),
    ("GET", "/api/v1/guides/bookings/{booking}/calendar.ics", None, "traveller"),
    ("GET", "/api/v1/guides/conversations/{conversation}", None, "traveller"),
    ("GET", "/api/v1/guides/engagements/{random}", None, "traveller"),
    ("GET", "/api/v1/guides/me/bookings/{booking}", None, "guide"),
    ("GET", "/api/v1/guides/me/days/{slot}", None, "guide"),
    ("GET", "/api/v1/guides/me/tours/{tour}/schedules", None, "guide"),
    ("GET", "/api/v1/guides/trips/{random}/engagements", None, "traveller"),
    ("POST", "/api/v1/guides/bookings/{booking}/arrived", None, "traveller"),
    ("POST", "/api/v1/guides/bookings/{booking}/cancel", {"reason": "Not mine"}, "traveller"),
    ("POST", "/api/v1/guides/bookings/{booking}/reschedule", {"slot_id": "{slot}", "message": ""}, "traveller"),
    ("POST", "/api/v1/guides/bookings/{booking}/reschedule/answer", {"accept": True}, "traveller"),
    ("POST", "/api/v1/guides/conversations/{conversation}/close", {"report": False, "reason": ""}, "traveller"),
    ("POST", "/api/v1/guides/conversations/{conversation}/messages", {"body": "Hello"}, "traveller"),
    ("POST", "/api/v1/guides/engagements/{random}/cancel", {"reason": "x"}, "traveller"),
    ("POST", "/api/v1/guides/engagements/{random}/decision", {"decision": "confirm"}, "traveller"),
    ("POST", "/api/v1/guides/me/bookings/{booking}/check-in", {"status": "arrived"}, "guide"),
    ("POST", "/api/v1/guides/me/bookings/{booking}/payment", {"amount_minor": 100, "method": "cash"}, "guide"),
    ("POST", "/api/v1/guides/me/days/{slot}/complete", None, "guide"),
    ("POST", "/api/v1/guides/me/days/{slot}/start", None, "guide"),
    ("POST", "/api/v1/guides/me/engagements/{random}/answer", {"answer": "decline", "reason": "x"}, "guide"),
    (
        "POST",
        "/api/v1/guides/me/engagements/{random}/proposal",
        {"stops": [{"slug": "x", "starts_at": "09:00", "ends_at": "10:00"}], "note": ""},
        "guide",
    ),
    (
        "POST",
        "/api/v1/guides/me/proposals/{random}/photos",
        {"filename": "a.jpg", "content_type": "image/jpeg", "content_base64": "{jpeg}", "rights_granted": True},
        "guide",
    ),
    ("POST", "/api/v1/guides/me/proposals/{random}/withdraw", None, "guide"),
    (
        "POST",
        "/api/v1/guides/me/requests/{booking}/respond",
        {"status": "rejected", "reason": "Not mine"},
        "guide",
    ),
    ("POST", "/api/v1/guides/me/tours/{tour}/publish", None, "guide"),
    ("POST", "/api/v1/guides/me/tours/{tour}/slots", None, "guide"),
    ("POST", "/api/v1/guides/reviews/{random}/reply", {"body": "Thanks"}, "guide"),
    ("PUT", "/api/v1/guides/me/tours/{tour}/booking-settings", {"instant_booking": False}, "guide"),
    ("PUT", "/api/v1/guides/me/tours/{tour}/content", {"highlights": ["x"]}, "guide"),
    (
        "PUT",
        "/api/v1/guides/me/tours/{tour}/schedules",
        {"weekdays": [0], "start_times": ["10:00"]},
        "guide",
    ),
]

# Routes with an id that are safe for anyone by design: public pages, the private feed (the
# id is the secret), admin routes (covered by the admin policy tests) and "book" routes (a
# slug of a published tour, open to every verified traveller).
EXEMPT_PREFIXES = ("/api/v1/admin/",)
EXEMPT = {
    "POST /api/v1/guides/tours/{tour_slug}/book",
    "POST /api/v1/guides/tours/{tour_slug}/request",
}


def _fill(value: Any, ids: dict[str, str]) -> Any:
    if isinstance(value, str):
        for key, real in ids.items():
            value = value.replace("{" + key + "}", real)
        return value
    if isinstance(value, dict):
        return {key: _fill(item, ids) for key, item in value.items()}
    if isinstance(value, list):
        return [_fill(item, ids) for item in value]
    return value


async def _owned_objects(clients: dict[str, AsyncClient], monkeypatch: pytest.MonkeyPatch) -> dict[str, str]:
    """A guide with a tour, a schedule, a block, a connected calendar and a booked run, and
    a traveller who booked it and wrote to the guide."""
    guide, traveller = clients["guide"], clients["traveller"]
    ready = await _ready(clients, f"Owner tour {uuid4().hex[:6]}")
    tour = ready["tour"]
    slot = await _slot(tour["id"], timedelta(minutes=20))
    await _register(traveller, "idor-traveller", verify=True)
    booking = await _book(traveller, tour["slug"], slot)

    schedule = await guide.put(
        f"/api/v1/guides/me/tours/{tour['id']}/schedules",
        json={"weekdays": [0], "start_times": ["08:00"]},
    )
    assert schedule.status_code == 200, schedule.text
    block = await guide.post(
        "/api/v1/guides/me/blocks",
        json={"starts_at": "2099-01-01T08:00:00+02:00", "ends_at": "2099-01-01T10:00:00+02:00"},
    )
    assert block.status_code == 200, block.text
    monkeypatch.setattr(guides_endpoint.ical_import, "fetch_calendar", lambda url: "BEGIN:VCALENDAR\r\nEND:VCALENDAR")
    calendars = await guide.post("/api/v1/guides/me/calendars", json={"url": "https://cal.example.com/owner.ics"})
    assert calendars.status_code == 200, calendars.text
    conversation = await traveller.post(
        "/api/v1/guides/conversations", json={"guide_slug": ready["profile"]["slug"], "body": "Hello"}
    )
    assert conversation.status_code == 200, conversation.text
    return {
        "tour": tour["id"],
        "slot": slot,
        "booking": booking["id"],
        "schedule": schedule.json()["id"],
        "block": block.json()["id"],
        "calendar": calendars.json()[0]["id"],
        "conversation": conversation.json()["id"],
        "random": RANDOM,
        "jpeg": b64(tiny_jpeg()),
    }


@pytest.mark.asyncio
async def test_no_one_reaches_another_persons_guide_objects(
    clients: dict[str, AsyncClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    ids = await _owned_objects(clients, monkeypatch)
    # The second guide is a real, approved guide with their own organisation.
    await _approved_guide({"guide": clients["other"], "admin": clients["other_admin"]})
    await _register(clients["stranger"], "idor-stranger", verify=True)
    callers = {"guide": clients["other"], "traveller": clients["stranger"]}

    leaks = []
    for method, template, body, who in CASES:
        path = _fill(template, ids)
        response = await callers[who].request(method, path, json=_fill(body, ids) if body is not None else None)
        if response.status_code not in REFUSED:
            leaks.append(f"{method} {template} as {who}: {response.status_code} {response.text[:120]}")
    assert not leaks, "\n".join(leaks)

    # The owners still reach their own objects: the refusals above are about ownership.
    assert (await clients["guide"].get(f"/api/v1/guides/me/bookings/{ids['booking']}")).status_code == 200
    assert (await clients["traveller"].get(f"/api/v1/guides/bookings/{ids['booking']}")).status_code == 200
    async with TestingSessionLocal() as session:
        cancelled = (
            await session.execute(
                text("SELECT status FROM app.bookings WHERE id = CAST(:b AS uuid)"), {"b": ids["booking"]}
            )
        ).scalar_one()
    assert cancelled == "confirmed", "nothing a stranger sent changed the booking"


def test_every_guide_route_with_an_id_is_covered() -> None:
    covered = {f"{method} {template}" for method, template, _, _ in CASES}
    # Normalise path parameter names: the table uses the fixture's names.
    shape = {_shape(key) for key in covered}
    missing = []
    for key, policy in route_policies(app).items():
        method, path = key.split(" ", 1)
        if "{" not in path or not path.startswith("/api/v1/guides") or key in EXEMPT:
            continue
        if path.startswith(EXEMPT_PREFIXES) or str(policy) in ("public", "job"):
            continue
        if _shape(key) not in shape:
            missing.append(key)
    assert not missing, f"add a case to CASES for: {missing}"


def _shape(key: str) -> str:
    """'POST /a/{booking_id}/b' and 'POST /a/{booking}/b' are the same route."""
    parts = []
    for part in key.split("/"):
        if part.startswith("{"):
            suffix = part[part.index("}") + 1 :]
            parts.append("{}" + suffix)
        else:
            parts.append(part)
    return "/".join(parts)
