"""Trip builder v2, phase 4: the whole day's price from published prices only, and a driver for the day."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from app.planner.day_session import ride_request_for
from app.planner.defaults import apply_defaults
from app.planner.schemas import DayDriverRequest, StepCandidate
from app.planner.script import parse_day_script
from app.planner.script.day import DayPools, PoolEntry, assemble_day
from app.planner.script.pricing import driver_price, exchange_line, price_day, stop_price
from app.schemas.partners import PlaceTypesIn

BEIRUT = ZoneInfo("Asia/Beirut")
BATROUN = (34.2553, 35.6581)


def listing(
    slug: str = "place",
    *,
    kind: str = "experience",
    price: dict[str, Any] | None = None,
    details: dict[str, Any] | None = None,
    types: list[str] | None = None,
    at: tuple[float, float] = BATROUN,
    opens: str = "07:00",
    closes: str = "23:59",
    minutes: int = 60,
) -> StepCandidate:
    return StepCandidate.model_validate(
        {
            "id": str(uuid4()),
            "slug": slug,
            "title": slug.replace("-", " ").title(),
            "status": "published",
            "duration_minutes": minutes,
            "destination_slug": "batroun",
            "venue_id": str(uuid4()),
            "lat": at[0],
            "lng": at[1],
            "listing_kind": kind,
            "place_types": types or [],
            "hours": [{"weekday": d, "opens": opens, "closes": closes} for d in range(7)],
            "price": price if price is not None else {"type": "from", "amount_minor": None, "has_rule": False},
            "details": details or {},
            "hybrid": 0.5,
        }
    )


def rule(kind: str, amount: int | None, *, high: int | None = None, unit: str = "person") -> dict[str, Any]:
    return {
        "type": kind,
        "amount_minor": amount,
        "max_amount_minor": high,
        "unit": unit,
        "currency": "USD",
        "has_rule": True,
    }


# ---- One place's price ----


def test_published_prices_are_used_for_the_whole_party() -> None:
    fixed = stop_price(listing(price=rule("fixed", 1500)), party=3)
    assert (fixed.basis, fixed.low_minor, fixed.high_minor, fixed.price_kind) == ("fixed", 4500, 4500, "fixed")
    group = stop_price(listing(price=rule("fixed", 6000, unit="group")), party=3)
    assert (group.quantity, group.low_minor) == (1, 6000)
    ranged = stop_price(listing(price=rule("range", 1000, high=1800)), party=2)
    assert (ranged.basis, ranged.low_minor, ranged.high_minor, ranged.price_kind) == ("range", 2000, 3600, "estimate")
    floor = stop_price(listing(price=rule("from", 2500)), party=2)
    assert (floor.basis, floor.low_minor, floor.high_minor) == ("from", 5000, None)
    estimated = stop_price(listing(price=rule("estimated", 900)), party=2)
    assert (estimated.basis, estimated.low_minor) == ("estimated", 1800)


def test_free_only_when_a_zero_price_is_published() -> None:
    free = stop_price(listing(price=rule("fixed", 0)), party=4)
    assert (free.basis, free.low_minor, free.price_kind) == ("free", 0, "fixed")
    unknown = stop_price(listing(), party=4)
    assert (unknown.basis, unknown.low_minor, unknown.price_kind) == ("on_request", None, "quote")
    quote = stop_price(listing(price=rule("quote", None)), party=4)
    assert quote.basis == "on_request" and quote.low_minor is None


def test_restaurants_and_stays_use_their_own_published_figures() -> None:
    meal = stop_price(listing(kind="restaurant", details={"typical_spend_minor": 1800, "currency": "USD"}), party=2)
    assert (meal.basis, meal.low_minor, meal.high_minor, meal.source) == ("typical_spend", 3600, 3600, "owner")
    night = stop_price(listing(kind="hotel", details={"price_from_minor": 9000}), party=2, role="stay")
    assert (night.kind, night.basis, night.unit, night.low_minor, night.high_minor) == (
        "stay",
        "per_night_from",
        "night",
        9000,
        None,
    )
    # A price rule, when there is one, always wins over the listing's own figures.
    ruled = stop_price(
        listing(kind="restaurant", price=rule("fixed", 2000), details={"typical_spend_minor": 1}), party=1
    )
    assert ruled.basis == "fixed" and ruled.low_minor == 2000


def test_a_driver_is_priced_from_published_day_rates_only() -> None:
    rates = [
        {"currency": "EUR", "drivers": 1, "low_minor": 5000, "high_minor": 5000},
        {"currency": "USD", "drivers": 3, "low_minor": 6000, "high_minor": 9000},
    ]
    line = driver_price(rates, "USD")
    assert (line.basis, line.low_minor, line.high_minor, line.currency) == ("driver_day_rate", 6000, 9000, "USD")
    assert "3 verified drivers" in line.note
    none = driver_price([], "USD")
    assert none.basis == "on_request" and none.low_minor is None


def test_a_money_changer_is_shown_with_its_rate_but_never_charged() -> None:
    line = exchange_line(1, {"branch_name": "Batroun", "rates": [{"posted_at": "09:10", "buy": 89000, "sell": 89500}]})
    assert line.basis == "exchange_rate" and line.low_minor is None
    assert "89500" in line.note


# ---- The day's total ----


def test_the_total_is_a_range_that_never_counts_unknown_as_free() -> None:
    lines = [
        stop_price(listing(price=rule("fixed", 1000)), party=2),  # 2000
        stop_price(listing(price=rule("range", 500, high=1500)), party=2),  # 1000-3000
        stop_price(listing(), party=2),  # on request
        exchange_line(4, {"branch_name": "Office"}),
    ]
    day = price_day(lines, currency="USD", party=2, budget=10_000)
    assert (day.low_minor, day.high_minor) == (3000, 5000)
    assert (day.per_person_low_minor, day.per_person_high_minor) == (1500, 2500)
    assert (day.priced_lines, day.on_request_lines) == (2, 1)
    assert day.budget_status == "within"


def test_an_open_ended_price_makes_the_total_open_ended() -> None:
    lines = [
        stop_price(listing(price=rule("from", 4000)), party=1),
        stop_price(listing(price=rule("fixed", 1000)), party=1),
    ]
    day = price_day(lines, currency="USD", party=1, budget=4500)
    assert (day.low_minor, day.high_minor, day.per_person_high_minor) == (5000, None, None)
    assert day.budget_status == "over"
    straddling = price_day(
        [stop_price(listing(price=rule("range", 1000, high=9000)), party=1)], currency="USD", party=1, budget=5000
    )
    assert straddling.budget_status == "may_exceed"


def test_other_currencies_are_shown_not_added() -> None:
    euro = stop_price(listing(price={**rule("fixed", 1000), "currency": "EUR"}), party=1)
    day = price_day([euro], currency="USD", party=1, budget=None)
    assert (day.low_minor, day.other_currency_lines, day.budget_status) == (0, 1, "unknown")


# ---- Priced inside the assembled day ----


def test_the_assembled_day_carries_a_priced_line_per_step_and_the_driver() -> None:
    script = parse_day_script("I want a driver in Batroun: breakfast, then bowling, then a museum, then a hotel")
    constraints, _assumed = apply_defaults(script.constraints)
    pools = DayPools(driver_rates=[{"currency": "USD", "drivers": 2, "low_minor": 7000, "high_minor": 8000}])
    pools.places[1] = [
        PoolEntry(
            listing(
                "bakery", kind="restaurant", details={"typical_spend_minor": 800, "reservation_phone": "+9613000000"}
            )
        )
    ]
    pools.places[2] = [PoolEntry(listing("lanes", price=rule("range", 1000, high=1500), opens="10:00"))]
    pools.places[3] = [PoolEntry(listing("museum", opens="09:00", closes="18:00"))]  # nothing published
    pools.places[4] = [
        PoolEntry(
            listing("hotel", kind="hotel", details={"price_from_minor": 12000, "booking_url": "https://example.com"})
        )
    ]
    day = assemble_day(script, constraints, pools, start_at_first_stop=True)
    assert [outcome.status for outcome in day.outcomes] == ["filled"] * 4
    bases = [outcome.price.basis if outcome.price else None for outcome in day.outcomes]
    assert bases == ["typical_spend", "range", "on_request", "per_night_from"]
    museum = day.outcomes[2]
    assert museum.estimated_minor == 0 and museum.price_kind == "quote" and "quote_required" in museum.flags
    assert day.outcomes[0].actions == {"reservation_phone": "+9613000000"}
    assert day.outcomes[3].actions == {"booking_url": "https://example.com"}
    party = constraints.party_size or 2
    pricing = day.pricing
    assert pricing.on_request_lines == 1
    assert pricing.low_minor == 800 * party + 1000 * party + 12000 + 7000
    assert pricing.high_minor is None, "the hotel only publishes a 'from' price"
    assert [item.kind for item in day.plan.cost_items] == ["transport"]
    assert day.plan.total_minor == pricing.low_minor


def test_a_strict_budget_uses_published_floors() -> None:
    script = parse_day_script("lunch then a museum")
    constraints, _assumed = apply_defaults(
        script.constraints.model_copy(update={"budget_minor": 3000, "strict_budget": True, "party_size": 1})
    )
    pools = DayPools()
    pools.places[1] = [PoolEntry(listing("grill", kind="restaurant", details={"typical_spend_minor": 2500}))]
    pools.places[2] = [
        PoolEntry(listing("dear-museum", price=rule("fixed", 1000), at=(34.26, 35.66))),
        PoolEntry(listing("unpriced-museum", at=(34.261, 35.661))),
    ]
    day = assemble_day(script, constraints, pools)
    assert day.outcomes[1].slug == "unpriced-museum", "over budget is refused; unknown is allowed but flagged"
    assert day.pricing.on_request_lines == 1


# ---- A driver for the day ----


def version(day: list[dict[str, Any]], **extra: Any) -> dict[str, Any]:
    return {
        "trip_id": "trip-1",
        "party_size": 3,
        "window_start": "2026-10-01T08:00:00+03:00",
        "constraints": {"day": day, "destination_slugs": ["batroun"]},
        **extra,
    }


def step(order: int, status: str, start: str, end: str, **extra: Any) -> dict[str, Any]:
    return {
        "order": order,
        "status": status,
        "starts_at": f"2026-10-01T{start}:00+03:00",
        "ends_at": f"2026-10-01T{end}:00+03:00",
        **extra,
    }


def test_the_ride_request_is_built_from_the_sealed_day() -> None:
    day = [
        step(1, "office", "08:05", "08:20", office={"branch_name": "Batroun branch"}, destination_slug="batroun"),
        step(2, "filled", "08:30", "09:10", title="Knefeh House", destination_slug="batroun"),
        {"order": 3, "status": "empty", "reason": "no_trusted_match"},
        step(4, "filled", "20:00", "21:30", title="Strike Lanes", destination_slug="batroun"),
    ]
    body = ride_request_for(
        version(day), DayDriverRequest(pickup_name="Hotel lobby", pickup_lat=34.25, pickup_lng=35.66)
    )
    assert body["kind"] == "day" and body["destination"] == "batroun"
    assert body["hours"] == 14 and body["party_size"] == 3 and body["trip_id"] == "trip-1"
    assert body["pickup_name"] == "Hotel lobby" and body["pickup_lat"] == 34.25
    assert "08:05 Batroun branch" in body["notes"] and "20:00 Strike Lanes" in body["notes"]
    assert "no_trusted_match" not in body["notes"], "only real stops go to drivers"
    assert datetime.fromisoformat(body["starts_at"]).astimezone(BEIRUT).hour == 8


def test_short_days_book_at_least_two_hours_and_long_days_say_so() -> None:
    short = ride_request_for(
        version([step(1, "filled", "10:00", "10:30", title="Museum")], window_start="2026-10-01T10:00:00+03:00"),
        DayDriverRequest(pickup_name="Lobby"),
    )
    assert short["hours"] == 2
    long_day = version([step(1, "filled", "08:00", "09:00", title="A"), step(2, "filled", "23:00", "23:59", title="B")])
    assert "agree the rest of the day" in ride_request_for(long_day, DayDriverRequest(pickup_name="Lobby"))["notes"]


def test_no_driver_request_without_stops_or_place() -> None:
    with pytest.raises(ValueError, match="no stops"):
        ride_request_for(version([{"order": 1, "status": "empty"}]), DayDriverRequest(pickup_name="Lobby"))
    nowhere = version(
        [step(1, "filled", "10:00", "11:00", title="A")],
        constraints={"day": [step(1, "filled", "10:00", "11:00", title="A")]},
    )
    with pytest.raises(ValueError, match="where the day is spent"):
        ride_request_for(nowhere, DayDriverRequest(pickup_name="Lobby"))
    with pytest.raises(ValidationError):
        DayDriverRequest(pickup_name="x")
    with pytest.raises(ValidationError):
        DayDriverRequest(pickup_name="Lobby", pickup_lat=48.8, pickup_lng=2.3)


def test_owners_send_a_typical_spend_in_cents() -> None:
    assert PlaceTypesIn(place_types=["grill"], typical_spend_minor=2500).typical_spend_minor == 2500
    with pytest.raises(ValidationError):
        PlaceTypesIn(place_types=["grill"], typical_spend_minor=5)
