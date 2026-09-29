"""Guide plan step 6: the guide's workspace.

The rules worth protecting: a guide's other calendar is read safely (https only, public
addresses only, capped) and only its busy time is kept, which then keeps travellers from
booking over it; the private calendar feed is reachable only by its secret address and
stops working when replaced or revoked; check-in and payment happen on the day and only on
the guide's own bookings; the statement adds up what the guide recorded, without inventing
a fee; and the insights count what really happened.
"""

from __future__ import annotations

import socket
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy import text

from app.api.v1.endpoints import guides as guides_endpoint
from app.core import ical_import
from app.core.config import settings
from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from tests.conftest import TestingSessionLocal
from tests.test_guide_after_booking import _book, _ready, _slot
from tests.test_guide_tours import _client, _register

BEIRUT = ZoneInfo("Asia/Beirut")
NOW = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)


@pytest.fixture
async def clients() -> AsyncGenerator[dict[str, AsyncClient], None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    made = {"guide": _client(), "admin": _client(), "traveller": _client(), "anon": _client(), "other": _client()}
    try:
        yield made
    finally:
        for client in made.values():
            await client.aclose()


def _ics(*events: str) -> str:
    return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + "".join(events) + "END:VCALENDAR\r\n"


def _event(*lines: str) -> str:
    return "BEGIN:VEVENT\r\n" + "".join(f"{line}\r\n" for line in lines) + "END:VEVENT\r\n"


# ---- Reading a calendar file ----------------------------------------------------------------


def test_only_busy_time_is_read_from_a_calendar_file() -> None:
    text_body = _ics(
        _event("UID:a", "SUMMARY:Dentist", "DTSTART:20261002T080000Z", "DTEND:20261002T090000Z"),
        # Free time, cancelled events, alarms and events long past are not busy.
        _event("UID:b", "DTSTART:20261003T080000Z", "DTEND:20261003T090000Z", "TRANSP:TRANSPARENT"),
        _event("UID:c", "DTSTART:20261004T080000Z", "DTEND:20261004T090000Z", "STATUS:CANCELLED"),
        _event("UID:d", "DTSTART:20250101T080000Z", "DTEND:20250101T090000Z"),
        _event(
            "UID:e",
            "DTSTART;TZID=Asia/Beirut:20261005T100000",
            "DURATION:PT1H30M",
            "BEGIN:VALARM",
            "TRIGGER:-PT15M",
            "DTSTART:20300101T000000Z",
            "END:VALARM",
        ),
        _event("UID:f", "DTSTART;VALUE=DATE:20261006", "DTEND;VALUE=DATE:20261007"),
        # A long title folded over two lines is still one event.
        _event("UID:g", "SUMMARY:A very long", "  title", "DTSTART:20261007T080000Z", "DTEND:20261007T083000Z"),
        # Unknown Windows zone names fall back to Beirut.
        _event(
            "UID:h", "DTSTART;TZID=GTB Standard Time:20261008T100000", "DTEND;TZID=GTB Standard Time:20261008T110000"
        ),
    )
    periods = ical_import.busy_periods(text_body, now=NOW)
    assert [(p.starts_at.astimezone(UTC), p.ends_at - p.starts_at) for p in periods] == [
        (datetime(2026, 10, 2, 8, 0, tzinfo=UTC), timedelta(hours=1)),
        (datetime(2026, 10, 5, 7, 0, tzinfo=UTC), timedelta(hours=1, minutes=30)),
        (datetime(2026, 10, 5, 21, 0, tzinfo=UTC), timedelta(days=1)),
        (datetime(2026, 10, 7, 8, 0, tzinfo=UTC), timedelta(minutes=30)),
        (datetime(2026, 10, 8, 7, 0, tzinfo=UTC), timedelta(hours=1)),
    ]
    assert set(periods[0].as_json()) == {"starts_at", "ends_at"}, "nothing but the time leaves the parser"


def test_repeating_events_are_expanded_over_the_window() -> None:
    weekly = _event(
        "UID:w",
        "DTSTART;TZID=Asia/Beirut:20260907T090000",
        "DTEND;TZID=Asia/Beirut:20260907T100000",
        "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261031T000000Z",
        "EXDATE;TZID=Asia/Beirut:20261007T090000",
    )
    starts = [p.starts_at.date().isoformat() for p in ical_import.busy_periods(_ics(weekly), now=NOW)]
    assert starts == [
        "2026-10-05",
        "2026-10-12",
        "2026-10-14",
        "2026-10-19",
        "2026-10-21",
        "2026-10-26",
        "2026-10-28",
    ], "Mondays and Wednesdays from now until the end date, minus the skipped one"

    # A daily habit started years ago still reaches today, and stops at the 120-day horizon.
    daily = _event("UID:d", "DTSTART:20100101T060000Z", "DTEND:20100101T070000Z", "RRULE:FREQ=DAILY")
    runs = ical_import.busy_periods(_ics(daily), now=NOW)
    assert runs[0].starts_at == datetime(2026, 10, 2, 6, 0, tzinfo=UTC)
    assert len(runs) == 120

    counted = _event("UID:c", "DTSTART:20260928T060000Z", "DTEND:20260928T070000Z", "RRULE:FREQ=DAILY;COUNT=5")
    assert [p.starts_at.day for p in ical_import.busy_periods(_ics(counted), now=NOW)] == [2], (
        "five runs from 28 September: only the 2nd of October is still ahead"
    )

    monthly = _event("UID:m", "DTSTART:20260831T060000Z", "DTEND:20260831T070000Z", "RRULE:FREQ=MONTHLY;COUNT=6")
    assert [p.starts_at.month for p in ical_import.busy_periods(_ics(monthly), now=NOW)] == [10, 12], (
        "months without a 31st are skipped, and 31 January is past the window"
    )

    # A rule we do not expand keeps its first run and invents nothing.
    odd = _event("UID:o", "DTSTART:20261010T060000Z", "DTEND:20261010T070000Z", "RRULE:FREQ=MONTHLY;BYDAY=2SA")
    assert len(ical_import.busy_periods(_ics(odd), now=NOW)) == 1


def test_a_calendar_address_is_read_safely(monkeypatch: pytest.MonkeyPatch) -> None:
    addresses = {"cal.example.com": "93.184.216.34", "evil.example.com": "10.0.0.5", "v6.example.com": "::1"}

    def fake_getaddrinfo(host: str, port: int, *args: Any, **kwargs: Any) -> list[Any]:
        if host not in addresses:
            raise socket.gaierror("unknown")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (addresses[host], port))]

    calendar_file = _ics(_event("UID:a", "DTSTART:20261002T080000Z", "DTEND:20261002T090000Z"))
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path == "/redirect":
            return httpx.Response(302, headers={"location": "https://evil.example.com/steal"})
        if request.url.path == "/big":
            return httpx.Response(200, content=b"BEGIN:VCALENDAR\r\n" + b"x" * (ical_import.MAX_BYTES + 10))
        if request.url.path == "/page":
            return httpx.Response(200, text="<html>not a calendar</html>")
        if request.url.path == "/gone":
            return httpx.Response(404)
        return httpx.Response(200, text=calendar_file)

    real_client = httpx.Client
    monkeypatch.setattr(ical_import.socket, "getaddrinfo", fake_getaddrinfo)
    monkeypatch.setattr(
        ical_import.httpx, "Client", lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)
    )

    assert "BEGIN:VEVENT" in ical_import.fetch_calendar("https://cal.example.com/private/basic.ics")
    request = seen[-1]
    assert request.url.host == "93.184.216.34", "the connection is pinned to the address that was checked"
    assert request.headers["host"] == "cal.example.com"
    assert request.extensions["sni_hostname"] == "cal.example.com"

    refused = {
        "http://cal.example.com/basic.ics": "only https",
        "https://evil.example.com/basic.ics": "not a public calendar",
        "https://v6.example.com/basic.ics": "not a public calendar",
        "https://user:pw@cal.example.com/basic.ics": "not a public calendar",
        "https://cal.example.com:8443/basic.ics": "not a public calendar",
        "https://nowhere.example.com/basic.ics": "could not be found",
        "https://cal.example.com/redirect": "not a public calendar",
        "https://cal.example.com/big": "too large",
        "https://cal.example.com/page": "not a calendar file",
        "https://cal.example.com/gone": "answered 404",
    }
    for url, reason in refused.items():
        with pytest.raises(ical_import.CalendarFetchError, match=reason):
            ical_import.fetch_calendar(url)
    assert all(r.url.host == "93.184.216.34" for r in seen), "no private address was ever contacted"


# ---- Connected calendars ---------------------------------------------------------------------


async def _external_blocks(profile_id: str) -> int:
    async with TestingSessionLocal() as session:
        return int(
            (
                await session.execute(
                    text(
                        "SELECT count(*) FROM app.guide_busy_blocks "
                        "WHERE guide_profile_id = CAST(:g AS uuid) AND kind = 'external'"
                    ),
                    {"g": profile_id},
                )
            ).scalar_one()
        )


@pytest.mark.asyncio
async def test_busy_time_from_another_calendar_stops_bookings(
    clients: dict[str, AsyncClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    ready = await _ready(clients, "Anjar ruins walk")
    tour, profile = ready["tour"], ready["profile"]
    busy_slot = await _slot(tour["id"], timedelta(days=4))
    async with TestingSessionLocal() as session:
        starts = (
            await session.execute(text("SELECT starts_at FROM app.slots WHERE id = CAST(:s AS uuid)"), {"s": busy_slot})
        ).scalar_one()
    stamp = "%Y%m%dT%H%M%SZ"
    busy = _ics(
        _event(
            "UID:x",
            "SUMMARY:Private family lunch",
            f"DTSTART:{(starts - timedelta(minutes=30)).astimezone(UTC).strftime(stamp)}",
            f"DTEND:{(starts + timedelta(hours=1)).astimezone(UTC).strftime(stamp)}",
        )
    )
    reads: list[str] = []

    def fake_fetch(url: str) -> str:
        reads.append(url)
        if "broken" in url:
            raise ical_import.CalendarFetchError("the calendar answered 500")
        return busy if "google" in url else _ics()

    monkeypatch.setattr(guides_endpoint.ical_import, "fetch_calendar", fake_fetch)

    bad = await guide.post("/api/v1/guides/me/calendars", json={"url": "ftp://files.example.com/cal.ics"})
    assert bad.status_code == 422

    added = await guide.post(
        "/api/v1/guides/me/calendars",
        json={"url": "webcal://calendar.google.com/calendar/ical/secret-part/basic.ics", "label": "Personal"},
    )
    assert added.status_code == 200, added.text
    row = added.json()[0]
    assert reads == ["https://calendar.google.com/calendar/ical/secret-part/basic.ics"], "webcal becomes https"
    assert row["host"] == "calendar.google.com" and "url" not in row, "the secret address is never shown back"
    assert row["last_status"] == "ok" and row["events"] == 1
    assert await _external_blocks(profile["id"]) == 1

    month = (await guide.get("/api/v1/guides/me/calendar", params={"from": starts.date(), "to": starts.date()})).json()
    external = [block for block in month["blocks"] if block["kind"] == "external"]
    assert len(external) == 1 and external[0]["note"] == "", "the event's title is never stored"
    assert (
        await guide.get("/api/v1/guides/me/calendar", params={"from": "2026-01-01", "to": "2026-06-01"})
    ).status_code == 422, "two months at most"

    await _register(traveller, "busy-traveller", verify=True)
    clash = await traveller.post(
        f"/api/v1/guides/tours/{tour['slug']}/book",
        json={"slot_id": busy_slot, "adults": 1},
        headers={"Idempotency-Key": f"busy-{uuid4().hex}"},
    )
    assert clash.status_code == 409, "a traveller cannot book over the guide's other commitments"

    # A calendar that cannot be read keeps the last known busy time.
    await guide.post("/api/v1/guides/me/calendars", json={"url": "https://cal.example.com/broken.ics"})
    listed = (await guide.get("/api/v1/guides/me/calendars")).json()
    assert [c["last_status"] for c in listed] == ["ok", "failed"]
    assert listed[1]["last_error"] == "the calendar answered 500"
    assert await _external_blocks(profile["id"]) == 1

    for n in range(1):
        await guide.post("/api/v1/guides/me/calendars", json={"url": f"https://cal.example.com/{n}.ics"})
    assert len((await guide.get("/api/v1/guides/me/calendars")).json()) == 3
    too_many = await guide.post("/api/v1/guides/me/calendars", json={"url": "https://cal.example.com/4.ics"})
    assert too_many.status_code == 413

    synced = await guide.post("/api/v1/guides/me/calendars/sync")
    assert synced.status_code == 200

    # Another guide can neither see nor remove it; removing it frees the time.
    other = clients["other"]
    await _register(other, "other-user")
    assert (await other.delete(f"/api/v1/guides/me/calendars/{row['id']}")).status_code in (403, 404)
    removed = await guide.delete(f"/api/v1/guides/me/calendars/{row['id']}")
    assert removed.status_code == 200 and len(removed.json()) == 2
    assert await _external_blocks(profile["id"]) == 0
    booked = await _book(traveller, tour["slug"], busy_slot)
    assert booked["status"] == "confirmed"


@pytest.mark.asyncio
async def test_the_calendar_job_reads_every_calendar(
    clients: dict[str, AsyncClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    guide = clients["guide"]
    await _ready(clients, "Tyre old port")
    monkeypatch.setattr(guides_endpoint.ical_import, "fetch_calendar", lambda url: _ics())
    await guide.post("/api/v1/guides/me/calendars", json={"url": "https://cal.example.com/job.ics"})
    result = await clients["anon"].post("/api/v1/guides/ops/calendar-sync", headers={"X-Job-Token": settings.job_token})
    assert result.status_code == 200, result.text
    assert result.json()["synced"] >= 1 and result.json()["failed"] == 0


# ---- The private feed --------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_the_private_feed_opens_only_with_its_address(clients: dict[str, AsyncClient]) -> None:
    guide, traveller, anon = clients["guide"], clients["traveller"], clients["anon"]
    ready = await _ready(clients, "Byblos harbour walk")
    slot = await _slot(ready["tour"]["id"], timedelta(days=2))
    await _register(traveller, "feed-traveller", verify=True)
    await _book(traveller, ready["tour"]["slug"], slot)

    assert (await guide.get("/api/v1/guides/me/calendar-feed")).json()["active"] is False
    first = (await guide.post("/api/v1/guides/me/calendar-feed")).json()
    assert first["active"] is True and first["url"].endswith(".ics")
    status = (await guide.get("/api/v1/guides/me/calendar-feed")).json()
    assert "url" not in status, "the address is shown once"
    path = "/api/v1/guides/feeds/" + first["url"].rsplit("/feeds/", 1)[1]

    feed = await anon.get(path)
    assert feed.status_code == 200
    assert feed.headers["content-type"].startswith("text/calendar")
    assert "Byblos harbour walk" in feed.text and "2 guests" in feed.text
    assert "feed-traveller" not in feed.text, "no guest names in the feed"

    async with TestingSessionLocal() as session:
        stored = (await session.execute(text("SELECT token_hash FROM app.guide_calendar_feeds"))).scalars().all()
    token = path.rsplit("/", 1)[1].removesuffix(".ics")
    assert token not in stored, "only the hash is stored"

    second = (await guide.post("/api/v1/guides/me/calendar-feed")).json()
    assert (await anon.get(path)).status_code == 404, "a new address retires the old one"
    new_path = "/api/v1/guides/feeds/" + second["url"].rsplit("/feeds/", 1)[1]
    assert (await anon.get(new_path)).status_code == 200
    assert (await guide.delete("/api/v1/guides/me/calendar-feed")).json()["active"] is False
    assert (await anon.get(new_path)).status_code == 404
    assert (await anon.get("/api/v1/guides/feeds/short.ics")).status_code == 404


# ---- On the day, the statement and insights ------------------------------------------------------


@pytest.mark.asyncio
async def test_check_in_payment_statement_and_insights(clients: dict[str, AsyncClient]) -> None:
    guide, traveller = clients["guide"], clients["traveller"]
    ready = await _ready(clients, "Batroun old souk")
    tour = ready["tour"]
    soon = await _slot(tour["id"], timedelta(minutes=20))
    later = await _slot(tour["id"], timedelta(days=5))
    await _register(traveller, "day-traveller", verify=True)
    today = await _book(traveller, tour["slug"], soon)
    future = await _book(traveller, tour["slug"], later)

    base = "/api/v1/guides/me/bookings"
    early = await guide.post(f"{base}/{future['id']}/check-in", json={"status": "arrived"})
    assert early.status_code == 422, "not on the day"
    too_soon = await guide.post(f"{base}/{today['id']}/check-in", json={"status": "no_show"})
    assert too_soon.status_code == 422, "a no-show is marked after the start"
    arrived = await guide.post(f"{base}/{today['id']}/check-in", json={"status": "arrived"})
    assert arrived.status_code == 200, arrived.text
    assert arrived.json()["checked_in_at"] is not None and arrived.json()["no_show"] is False

    paid = await guide.post(f"{base}/{today['id']}/payment", json={"amount_minor": 5000, "method": "cash"})
    assert paid.status_code == 200, paid.text
    assert paid.json()["paid_minor"] == 5000 and paid.json()["paid_method"] == "cash"
    assert (
        await guide.post(f"{base}/{future['id']}/payment", json={"amount_minor": 1, "method": "cash"})
    ).status_code == 422
    assert (
        await guide.post(f"{base}/{today['id']}/payment", json={"amount_minor": 1, "method": "bitcoin"})
    ).status_code == 422

    other = clients["other"]
    await _register(other, "not-the-guide")
    assert (await other.post(f"{base}/{today['id']}/check-in", json={"status": "arrived"})).status_code in (403, 404)

    month = datetime.now(BEIRUT).date().replace(day=1)
    statement = (await guide.get("/api/v1/guides/me/earnings", params={"month": month.isoformat()})).json()
    assert statement["fee_percent"] == 0, "the fee is what it is today, never estimated"
    assert statement["recorded_minor"] >= 5000 and statement["net_minor"] == statement["recorded_minor"]
    assert any(row["code"] == today["code"] and row["paid_minor"] == 5000 for row in statement["rows"])
    assert statement["upcoming_bookings"] >= 1

    csv_file = await guide.get("/api/v1/guides/me/earnings.csv", params={"month": month.isoformat()})
    assert csv_file.status_code == 200 and csv_file.headers["content-type"].startswith("text/csv")
    assert today["code"] in csv_file.text and "50.00" in csv_file.text and "yours_usd,50.00" in csv_file.text

    insights = (await guide.get("/api/v1/guides/me/insights", params={"days": 30})).json()
    row = next(item for item in insights["tours"] if item["id"] == tour["id"])
    assert row["confirmed"] == 2 and row["bookings"] == 2 and row["guests"] == 4
    assert (await guide.get("/api/v1/guides/me/insights", params={"days": 1})).status_code == 422


def test_spreadsheet_cells_cannot_run_formulas() -> None:
    assert guides_endpoint._csv_cell("=HYPERLINK(1)") == "'=HYPERLINK(1)"
    assert guides_endpoint._csv_cell("+1") == "'+1"
    assert guides_endpoint._csv_cell("Batroun") == "Batroun"
    assert guides_endpoint._csv_cell(None) == ""
    assert guides_endpoint._csv_line(["Tour, with comma", 'Say "hi"', "-5", 3]) == (
        '"Tour, with comma","Say ""hi""",\'-5,3\r\n'
    )
