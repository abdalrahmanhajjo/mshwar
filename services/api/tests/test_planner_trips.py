"""Trip builder v2, phase 6: trips of several days, told day by day."""

from __future__ import annotations

from datetime import datetime, time
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.planner.day_session import patch_trip, reads_as_day, ride_request_for
from app.planner.defaults import apply_defaults
from app.planner.schemas import DayDriverRequest, StepCandidate
from app.planner.script import parse_day_script
from app.planner.script.day import DayPools, PoolEntry
from app.planner.script.trip import assemble_trip, split_days

BEIRUT = ZoneInfo("Asia/Beirut")
BYBLOS = (34.1212, 35.6481)
BSHARRI = (34.2508, 36.0114)


def place(
    slug: str, types: list[str], at: tuple[float, float], *, amount: int = 1000, minutes: int = 60
) -> StepCandidate:
    return StepCandidate.model_validate(
        {
            "id": str(uuid4()),
            "slug": slug,
            "title": slug.replace("-", " ").title(),
            "status": "published",
            "duration_minutes": minutes,
            "destination_slug": "byblos",
            "venue_id": str(uuid4()),
            "lat": at[0],
            "lng": at[1],
            "place_types": types,
            "listing_kind": "hotel" if "hotel" in types else "experience",
            "hours": [{"weekday": d, "opens": "07:00", "closes": "23:30"} for d in range(7)],
            "price": {"type": "fixed", "amount_minor": amount, "unit": "person", "currency": "USD", "has_rule": True},
            "hybrid": 0.5,
        }
    )


def test_days_are_split_in_every_language() -> None:
    assert split_days("Day 1: castle then seafood then a hotel. Day 2: cedars then lunch") == [
        "castle then seafood then a hotel",
        "cedars then lunch",
    ]
    assert split_days("اليوم الأول قلعة جبيل وسمك وفندق، اليوم التاني الأرز وغدا") == [
        "قلعة جبيل وسمك وفندق",
        "الأرز وغدا",
    ]
    assert split_days("Jour 1 : musée puis dîner. Le lendemain : plage") == ["musée puis dîner", "plage"]
    assert split_days("museum then dinner. the next day beach. the day after cedars") == [
        "museum then dinner",
        "beach",
        "cedars",
    ]
    assert split_days("we are 4 with a driver: day 1 museum, day 2 beach") == [
        "we are 4 with a driver: museum",
        "beach",
    ]
    assert split_days("day 2: beach. day 1: museum") == ["museum", "beach"], "numbered days go in their place"
    assert split_days("museum, then a day in the mountains") == ["museum, then a day in the mountains"]


def test_a_request_of_several_days_is_a_step_by_step_trip() -> None:
    assert reads_as_day("day 1: museum. day 2: beach", "en", [])
    assert not reads_as_day("a slow day in Byblos for two", "en", [])


def test_day_two_starts_where_day_one_slept_and_the_trip_is_priced_as_one() -> None:
    scripts = [parse_day_script("castle then seafood dinner then a hotel"), parse_day_script("cedars then lunch")]
    constraints, _assumed = apply_defaults(
        scripts[0].constraints.model_copy(update={"party_size": 2, "budget_minor": 50_000})
    )
    day_one, day_two = DayPools(), DayPools()
    day_one.places[1] = [PoolEntry(place("byblos-castle", ["castle"], BYBLOS))]
    day_one.places[2] = [PoolEntry(place("fish-house", ["seafood"], BYBLOS, amount=2500, minutes=90))]
    day_one.places[3] = [PoolEntry(place("harbour-hotel", ["hotel"], BYBLOS, amount=9000))]
    day_two.places[1] = [PoolEntry(place("cedars-of-god", ["cedars"], BSHARRI, minutes=90))]
    day_two.places[2] = [PoolEntry(place("bsharri-grill", ["grill"], BSHARRI, amount=1500))]
    trip = assemble_trip(scripts, constraints, [day_one, day_two])
    assert [(o.day, o.order, o.status) for o in trip.outcomes] == [
        (1, 1, "filled"),
        (1, 2, "filled"),
        (1, 3, "filled"),
        (2, 1, "filled"),
        (2, 2, "filled"),
    ]
    first_of_day_two = trip.outcomes[3]
    assert first_of_day_two.starts_at is not None
    assert first_of_day_two.starts_at.date() > trip.outcomes[0].starts_at.date()  # type: ignore[union-attr]
    assert first_of_day_two.travel_minutes and first_of_day_two.travel_minutes > 30, (
        "from the Byblos hotel to the Cedars"
    )
    assert [stop.position for stop in trip.plan.stops] == [1, 2, 3, 4, 5]
    assert [stop.snapshot["step"]["day"] for stop in trip.plan.stops] == [1, 1, 1, 2, 2]
    assert {line.day for line in trip.pricing.lines} == {1, 2}
    assert trip.pricing.low_minor == 2 * (1000 + 2500 + 1000 + 1500) + 9000 * 2
    assert trip.window_start < trip.return_by and trip.return_by.date() > trip.window_start.date()


def test_a_strict_budget_is_for_the_whole_trip() -> None:
    scripts = [parse_day_script("museum then lunch"), parse_day_script("castle then dinner")]
    constraints, _assumed = apply_defaults(
        scripts[0].constraints.model_copy(update={"party_size": 1, "budget_minor": 3000, "strict_budget": True})
    )
    pools = []
    for _day in range(2):
        day = DayPools()
        day.places[1] = [PoolEntry(place(f"sight-{uuid4().hex[:4]}", ["museum", "castle"], BYBLOS, amount=1000))]
        day.places[2] = [PoolEntry(place(f"meal-{uuid4().hex[:4]}", ["grill"], BYBLOS, amount=900))]
        pools.append(day)
    trip = assemble_trip(scripts, constraints, pools)
    assert trip.plan.total_minor == 3800
    assert trip.plan.needs_budget_approval, "each day fits, the trip does not"


def test_edits_go_to_the_day_named_or_the_first_day_they_fit() -> None:
    scripts = [parse_day_script("museum then bowling"), parse_day_script("beach then cinema")]
    named = patch_trip(scripts, "day 2: swap cinema for karting")
    assert named is not None and named[0] == 2
    assert [step.tags for step in named[1].script.steps] == [["beach"], ["karting"]]
    found = patch_trip(scripts, "remove the cinema")
    assert found is not None and found[0] == 2
    assert patch_trip(scripts, "day 3: remove the cinema") is None
    assert patch_trip(scripts, "remove the zoo") is None


def step(day: int, order: int, start: str, end: str, **extra: Any) -> dict[str, Any]:
    return {
        "day": day,
        "order": order,
        "status": "filled",
        "starts_at": f"2026-10-0{day}T{start}:00+03:00",
        "ends_at": f"2026-10-0{day}T{end}:00+03:00",
        "destination_slug": "byblos",
        **extra,
    }


def test_a_driver_can_be_asked_for_one_day_of_a_trip() -> None:
    version = {
        "trip_id": "t1",
        "party_size": 2,
        "window_start": "2026-10-01T09:00:00+03:00",
        "constraints": {
            "day": [
                step(1, 1, "09:10", "10:00", title="Castle"),
                step(2, 1, "09:30", "11:00", title="Cedars", destination_slug="bsharri"),
                step(2, 2, "12:00", "13:30", title="Grill", destination_slug="bsharri"),
            ]
        },
    }
    body = ride_request_for(version, DayDriverRequest(pickup_name="Hotel lobby", day=2))
    assert body["destination"] == "bsharri"
    assert body["starts_at"].startswith("2026-10-02T09:00")
    assert body["hours"] == 5
    assert "09:30 Cedars" in body["notes"] and "Castle" not in body["notes"]
    first = ride_request_for(version, DayDriverRequest(pickup_name="Hotel lobby"))
    assert "Castle" in first["notes"] and "Cedars" not in first["notes"]
    assert datetime.fromisoformat(first["starts_at"]).astimezone(BEIRUT).time() >= time(9)
