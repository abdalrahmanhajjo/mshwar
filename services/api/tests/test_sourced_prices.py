"""Real prices with proof (migration 047): staff record what a place or authority published."""

from __future__ import annotations

import contextlib
from collections.abc import AsyncGenerator, Iterator
from datetime import date, timedelta
from typing import Any
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from app.planner.schemas import SourcedPriceIn, StepCandidate
from app.planner.script.pricing import stop_price
from app.seed.sourced_prices import read_rows, record

TODAY = date.today().isoformat()
HEADER = "slug,price_type,amount,max_amount,currency,unit,source_url,source_name,checked_on,review_by,note\n"


def candidate(price: dict[str, Any]) -> StepCandidate:
    return StepCandidate.model_validate(
        {
            "id": str(uuid4()),
            "slug": "sea-castle",
            "title": "Sea Castle",
            "status": "published",
            "duration_minutes": 60,
            "destination_slug": "sidon",
            "venue_id": str(uuid4()),
            "lat": 33.56,
            "lng": 35.37,
            "price": price,
        }
    )


def test_a_sourced_price_carries_its_proof_to_the_traveller() -> None:
    line = stop_price(
        candidate(
            {
                "type": "fixed",
                "amount_minor": 500,
                "unit": "person",
                "currency": "USD",
                "has_rule": True,
                "source_url": "https://example.org/tickets",
                "source_name": "Directorate General of Antiquities",
                "checked_on": "2026-09-20",
            }
        ),
        party=2,
    )
    assert (line.basis, line.low_minor, line.source) == ("fixed", 1000, "published_source")
    assert (line.source_name, line.source_url, line.checked_on) == (
        "Directorate General of Antiquities",
        "https://example.org/tickets",
        "2026-09-20",
    )
    owner = stop_price(
        candidate({"type": "fixed", "amount_minor": 500, "unit": "person", "currency": "USD", "has_rule": True}), 1
    )
    assert owner.source == "price_rule" and owner.source_url is None


def test_the_csv_is_read_in_main_units_and_checked_row_by_row() -> None:
    rows, errors = read_rows(
        HEADER
        + f"jeita-grotto,fixed,18.00,,USD,person,https://example.org/jeita,Jeita official site,{TODAY},,Adult\n"
        + f"baalbek-temples,range,10,15,usd,person,https://example.org/baalbek,Ministry list,{TODAY},,\n"
        + f"no-proof,fixed,5,,USD,person,http://example.org,Somewhere,{TODAY},,\n"
        + f"too-precise,fixed,5.005,,USD,person,https://example.org,Site,{TODAY},,\n"
        + f",fixed,5,,USD,person,https://example.org,Site,{TODAY},,\n"
        + f"guessed,estimate,5,,USD,person,https://example.org,Site,{TODAY},,\n"
    )
    assert [(row.slug, row.payload.amount_minor, row.payload.max_amount_minor) for row in rows] == [
        ("jeita-grotto", 1800, None),
        ("baalbek-temples", 1000, 1500),
    ]
    assert rows[1].payload.currency == "USD"
    assert [(error.line, error.slug) for error in errors] == [
        (4, "no-proof"),
        (5, "too-precise"),
        (6, ""),
        (7, "guessed"),
    ]


def test_a_csv_without_the_proof_columns_is_refused() -> None:
    rows, errors = read_rows("slug,price_type,amount\njeita-grotto,fixed,18\n")
    assert rows == [] and "source_url" in errors[0].reason


def test_staff_input_requires_proof() -> None:
    ok = SourcedPriceIn(
        price_type="fixed",
        amount_minor=0,
        source_url="https://example.org/free",
        source_name="Municipality",
        checked_on=date.today(),
    )
    assert ok.unit == "person"
    for bad in (
        {"price_type": "quote"},
        {"source_url": "ftp://example.org"},
        {"source_name": ""},
        {"amount_minor": -1},
        {"currency": "usd"},
        {"invented": True},
    ):
        with pytest.raises(ValidationError):
            SourcedPriceIn.model_validate(
                {
                    "price_type": "fixed",
                    "amount_minor": 100,
                    "source_url": "https://example.org",
                    "source_name": "Site",
                    "checked_on": TODAY,
                    **bad,
                }
            )


class FakeConnection:
    """Enough of psycopg for ``record``: lookups, a savepoint per row, commit or rollback."""

    def __init__(self, listings: set[str], failing: set[str]) -> None:
        self.listings, self.failing = listings, failing
        self.calls: list[str] = []
        self.finished: str | None = None
        self._slug: str | None = None

    def execute(self, sql: str, params: tuple[Any, ...]) -> Any:
        self.calls.append(sql.split("(")[0])
        if "FROM app.users" in sql:
            return _Result(("admin-id",))
        if "FROM app.experiences" in sql:
            self._slug = params[0]
            return _Result((f"id-{params[0]}",) if params[0] in self.listings else None)
        if self._slug in self.failing:
            raise RuntimeError("a price starting on or after that day is already set\nCONTEXT: ...")
        return _Result(None)

    @contextlib.contextmanager
    def transaction(self) -> Iterator[None]:
        yield

    def commit(self) -> None:
        self.finished = "commit"

    def rollback(self) -> None:
        self.finished = "rollback"


class _Result:
    def __init__(self, row: tuple[Any, ...] | None) -> None:
        self.row = row

    def fetchone(self) -> tuple[Any, ...] | None:
        return self.row


def test_recording_reports_each_row_and_dry_runs_roll_back() -> None:
    rows, _errors = read_rows(
        HEADER
        + f"jeita-grotto,fixed,18,,USD,person,https://example.org/a,Site A,{TODAY},,\n"
        + f"unknown-place,fixed,5,,USD,person,https://example.org/b,Site B,{TODAY},,\n"
        + f"baalbek-temples,fixed,10,,USD,person,https://example.org/c,Site C,{TODAY},,\n"
    )
    conn = FakeConnection(listings={"jeita-grotto", "baalbek-temples"}, failing={"baalbek-temples"})
    recorded, errors = record(conn, "staff@example.com", rows, dry_run=True)
    assert recorded == 1
    assert [(error.slug, error.reason) for error in errors] == [
        ("unknown-place", "no listing with this slug"),
        ("baalbek-temples", "a price starting on or after that day is already set"),
    ]
    assert conn.finished == "rollback"
    conn = FakeConnection(listings={"jeita-grotto"}, failing=set())
    assert record(conn, "staff@example.com", rows[:1], dry_run=False)[0] == 1
    assert conn.finished == "commit"


# ---- Through the API (needs a migrated database) ----


@pytest.fixture
async def api() -> AsyncGenerator[AsyncClient, None]:
    limiter.reset()
    set_mailer(RecordingMailer())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    limiter.reset()
    set_mailer(None)


@pytest.mark.asyncio
async def test_staff_record_a_published_price_through_the_api(api: AsyncClient) -> None:
    from tests.test_booking_payments import _published_listing, _register

    catalog = await _published_listing(api)  # signed in as the owner, who is also an admin
    listing_id = catalog["listing"]["id"]
    body = {
        "price_type": "fixed",
        "amount_minor": 1800,
        "source_url": "https://example.org/tickets",
        "source_name": "Official ticket page",
        "checked_on": date.today().isoformat(),
        "review_by": (date.today() + timedelta(days=20)).isoformat(),
    }
    saved = await api.put(f"/api/v1/admin/prices/listings/{listing_id}", json=body)
    assert saved.status_code == 200, saved.text
    assert saved.json()["source_name"] == "Official ticket page"
    due = await api.get("/api/v1/admin/prices/due?days=30")
    assert due.status_code == 200
    assert listing_id in {item["experience_id"] for item in due.json()}
    refused = await api.put(f"/api/v1/admin/prices/listings/{listing_id}", json={**body, "source_url": "http://x.org"})
    assert refused.status_code == 422
    await _register(api, f"stranger-{uuid4().hex[:8]}@example.com", "Stranger")
    assert (await api.put(f"/api/v1/admin/prices/listings/{listing_id}", json=body)).status_code == 403
