"""Trip builder v2, phase 3: a whole day, step by step, from trusted places only.

The assembler is pure (no database); travel times come from the routing stub,
as everywhere in CI. The last test drives it through the API.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from datetime import datetime, time
from typing import Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from app.planner.defaults import apply_defaults
from app.planner.schemas import DayScript, ExtractedConstraints, StepCandidate, StepSpec
from app.planner.script import fill as fill_module, parse_day_script
from app.planner.script.day import DayPools, PoolEntry, assemble_day, day_window, orderings, step_window

BEIRUT = ZoneInfo("Asia/Beirut")
BATROUN = (34.2553, 35.6581)
USER_EXAMPLE = (
    "I want to get driver in batroun to go trip start currency changer then pass me at place do breakfast "
    "at sweat place then go see a mountain then after that eat dinner and after it play bowling then  watch "
    "film at cinema and finally stay night at hotel"
)


def place(
    slug: str,
    types: list[str],
    *,
    at: tuple[float, float] = BATROUN,
    minutes: int = 60,
    opens: str | None = "08:00",
    closes: str | None = "23:00",
    amount: int | None = 1500,
    **extra: Any,
) -> StepCandidate:
    hours = [] if opens is None else [{"weekday": d, "opens": opens, "closes": closes} for d in range(7)]
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
            "place_types": types,
            "hours": hours,
            "price": {"type": "from", "amount_minor": amount, "currency": "USD", "unit": "person"},
            "hybrid": 0.5,
            "trust": {"level": "checked_by_mshwar"},
            **extra,
        }
    )


def near(offset: float) -> tuple[float, float]:
    return (BATROUN[0] + offset, BATROUN[1] + offset)


def constraints_for(script: DayScript, **overrides: Any) -> ExtractedConstraints:
    merged, _assumed = apply_defaults(script.constraints.model_copy(update=overrides))
    return merged


def batroun_pools() -> DayPools:
    pools = DayPools()
    pools.offices[1] = [{"id": "office-1", "branch_name": "Batroun branch", "lat": 34.2553, "lng": 35.6581}]
    pools.places[2] = [PoolEntry(place("knefeh-house", ["sweets"], at=near(0.001), opens="07:00", closes="13:00"))]
    pools.places[3] = [PoolEntry(place("tannourine-view", ["mountain"], at=(34.21, 35.93), minutes=90))]
    pools.places[4] = [PoolEntry(place("harbour-grill", ["grill"], at=near(-0.001), opens="12:00", closes="23:30"))]
    pools.places[5] = [PoolEntry(place("strike-lanes", ["bowling"], at=near(0.015), opens="16:00", closes="01:00"))]
    pools.places[6] = [
        PoolEntry(
            place(
                "coast-cinema",
                ["cinema"],
                at=near(0.005),
                minutes=150,
                opens="14:00",
                closes="02:00",
                needs_schedule=True,
            )
        )
    ]
    pools.places[7] = [PoolEntry(place("harbour-hotel", ["hotel"], at=near(-0.0003), minutes=600))]
    return pools


def statuses(day: Any) -> list[str]:
    return [outcome.status for outcome in day.outcomes]


# ---- The whole Batroun day ----


def test_the_batroun_day_is_planned_step_by_step_in_order() -> None:
    script = parse_day_script(USER_EXAMPLE)
    day = assemble_day(script, constraints_for(script), batroun_pools(), start_at_first_stop=True)
    assert [outcome.order for outcome in day.outcomes] == list(range(1, 8))
    assert statuses(day) == ["office", "filled", "filled", "filled", "filled", "filled", "filled"]
    assert [outcome.slug for outcome in day.outcomes[1:]] == [
        "knefeh-house",
        "tannourine-view",
        "harbour-grill",
        "strike-lanes",
        "coast-cinema",
        "harbour-hotel",
    ]
    starts = [outcome.starts_at for outcome in day.outcomes]
    assert all(earlier <= later for earlier, later in zip(starts, starts[1:], strict=False) if earlier and later)
    local = {
        outcome.slug: outcome.starts_at.astimezone(BEIRUT).time()
        for outcome in day.outcomes
        if outcome.slug and outcome.starts_at
    }
    assert time(7) <= local["knefeh-house"] <= time(11), "breakfast is at breakfast time"
    assert local["harbour-grill"] >= time(18, 30), "dinner is at dinner time"
    cinema = next(outcome for outcome in day.outcomes if outcome.slug == "coast-cinema")
    assert "check_times" in cinema.flags, "we never invent a showtime"
    assert day.outcomes[0].travel_minutes is not None and day.outcomes[0].travel_minutes <= 2, (
        "picked up at the first stop"
    )
    assert day.window_start.astimezone(BEIRUT).time() == time(8, 0)
    assert day.return_by.astimezone(BEIRUT).time() == time(2, 0)
    # Only listings are saved as stops; the changer's office lives in the day outcomes.
    assert len(day.plan.stops) == 6 and len(day.plan.legs) == 6
    assert day.plan.stops[-1].snapshot["step"]["role"] == "stay"
    assert not day.plan.infeasible


def test_a_step_no_trusted_place_can_fill_stays_as_an_honest_gap() -> None:
    script = parse_day_script("breakfast, then bowling, then a museum")
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("cafe", ["cafe"], opens="07:00", closes="12:00"))]
    pools.places[2] = []
    pools.places[3] = [PoolEntry(place("museum", ["museum"], at=near(0.01)))]
    day = assemble_day(script, constraints_for(script), pools)
    assert statuses(day) == ["filled", "empty", "filled"]
    assert day.outcomes[1].reason == "no_trusted_match"
    assert len(day.plan.stops) == 2


def test_places_found_outside_the_destination_say_so() -> None:
    script = parse_day_script("bowling in Batroun")
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("jbeil-lanes", ["bowling"], at=(34.12, 35.65)), outside=True)]
    script = script.model_copy(update={"steps": script.steps})
    day = assemble_day(script, constraints_for(script), pools)
    assert "outside_destination" in day.outcomes[0].flags


def test_nothing_fills_the_day_is_infeasible_not_invented() -> None:
    script = parse_day_script("bowling then cinema")
    day = assemble_day(script, constraints_for(script), DayPools())
    assert statuses(day) == ["empty", "empty"]
    assert day.plan.infeasible and day.plan.infeasible_reason == "no_step_could_be_filled"


# ---- Time: windows, hours, the end of the day ----


def test_a_place_closed_that_day_is_not_used() -> None:
    script = parse_day_script("lunch then a museum")
    closed = place("closed-museum", ["museum"])
    closed = closed.model_copy(update={"hours": [], "exceptions": []})
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("grill", ["grill"], opens="11:00", closes="23:00"))]
    constraints = constraints_for(script)
    day_date = constraints.window_start.astimezone(BEIRUT).date() if constraints.window_start else None
    pools.places[2] = [
        PoolEntry(closed.model_copy(update={"exceptions": [{"local_date": str(day_date), "closed": True}]}))
    ]
    day = assemble_day(script, constraints, pools)
    assert statuses(day) == ["filled", "empty"]
    assert day.outcomes[1].reason == "closed_that_day"


def test_late_opening_hours_run_past_midnight() -> None:
    script = parse_day_script("dinner, then a club at 11pm")
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("grill", ["grill"], opens="12:00", closes="23:30"))]
    pools.places[2] = [
        PoolEntry(place("night-club", ["nightclub"], at=near(0.01), minutes=120, opens="22:00", closes="04:00"))
    ]
    # Start in Batroun: this is about hours past midnight, not the drive back to Beirut.
    day = assemble_day(script, constraints_for(script, start_lat=BATROUN[0], start_lng=BATROUN[1]), pools)
    assert statuses(day) == ["filled", "filled"]
    club = day.outcomes[1]
    assert club.starts_at is not None and club.starts_at.astimezone(BEIRUT).time() == time(23, 0)


def test_a_time_the_traveller_gave_is_kept() -> None:
    script = parse_day_script("breakfast at 9 then the souk")
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("bakery", ["bakery"], opens="06:00", closes="12:00"))]
    pools.places[2] = [PoolEntry(place("souk", ["souk"], at=near(0.005)))]
    day = assemble_day(script, constraints_for(script), pools)
    assert day.outcomes[0].starts_at is not None
    assert day.outcomes[0].starts_at.astimezone(BEIRUT).time() == time(9, 0)
    assert day.outcomes[0].wait_minutes == 0, "the traveller leaves just in time"
    assert day.window_start < day.outcomes[0].starts_at


def test_a_day_that_is_not_a_night_away_must_get_home_in_time() -> None:
    script = parse_day_script("lunch in Tyre, then a museum, back by 6")
    far = (33.27, 35.2)
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("tyre-fish", ["seafood"], at=far, minutes=90, opens="12:00", closes="23:00"))]
    pools.places[2] = [PoolEntry(place("tyre-museum", ["museum"], at=far, minutes=300))]
    constraints = constraints_for(script)
    day = assemble_day(script, constraints, pools)
    assert statuses(day)[1] == "empty"
    assert day.outcomes[1].reason in {"does_not_fit_the_day", "closes_too_early"}


def test_the_day_window_follows_what_was_asked() -> None:
    evening = parse_day_script("museum then dinner")
    start, end, notes = day_window(evening, constraints_for(evening))
    assert end.astimezone(BEIRUT).time() == time(23, 30) and "runs_into_the_evening" in notes
    landing = parse_day_script("We land at 10, lunch then the castle, back by 7")
    start, end, _notes = day_window(landing, constraints_for(landing))
    assert start.astimezone(BEIRUT).time() == time(10, 0)
    assert end.astimezone(BEIRUT).time() == time(19, 0)


def test_step_windows() -> None:
    assert step_window(StepSpec(order=1, role="meal", meal="dinner")) == (18 * 60 + 30, 22 * 60 + 30)
    assert step_window(StepSpec(order=1, role="sight", time_of_day="morning")) == (7 * 60, 12 * 60)
    assert step_window(StepSpec(order=1, role="activity", at=time(1, 0), time_of_day="night")) == (
        25 * 60,
        25 * 60 + 45,
    )
    assert step_window(StepSpec(order=1, role="sight")) is None


# ---- Choices: order, budget, reuse ----


def test_steps_joined_by_and_may_swap_to_fit() -> None:
    script = parse_day_script("in the afternoon bowling and karting")
    pools = DayPools()
    # Karting closes early; bowling is open late - only karting first fits both.
    pools.places[1] = [PoolEntry(place("lanes", ["bowling"], minutes=90, opens="14:00", closes="23:00"))]
    pools.places[2] = [PoolEntry(place("karts", ["karting"], at=near(0.01), minutes=60, opens="13:00", closes="15:00"))]
    day = assemble_day(script, constraints_for(script), pools)
    assert statuses(day) == ["filled", "filled"]
    assert [outcome.slug for outcome in day.outcomes] == ["karts", "lanes"]


def test_fixed_order_is_never_swapped() -> None:
    steps = parse_day_script("museum then lunch then bowling and karting").steps
    options = orderings(steps)
    assert len(options) == 2
    assert all([step.role for step in option[:2]] == ["sight", "meal"] for option in options)


def test_an_optional_step_is_skipped_when_it_does_not_fit() -> None:
    script = parse_day_script("lunch, then maybe a winery if there is time")
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("grill", ["grill"], opens="11:00", closes="23:00"))]
    pools.places[2] = []
    day = assemble_day(script, constraints_for(script), pools)
    assert statuses(day) == ["filled", "skipped"]


def test_a_strict_budget_picks_what_it_can_afford() -> None:
    script = parse_day_script("lunch then a museum")
    pools = DayPools()
    pools.places[1] = [PoolEntry(place("grill", ["grill"], opens="11:00", closes="23:00", amount=2000))]
    pools.places[2] = [
        PoolEntry(place("pricey-museum", ["museum"], at=near(0.004), amount=90_000)),
        PoolEntry(place("free-museum", ["museum"], at=near(0.006), amount=500)),
    ]
    constraints = constraints_for(script, budget_minor=10_000, strict_budget=True, party_size=2)
    day = assemble_day(script, constraints, pools)
    assert day.outcomes[1].slug == "free-museum"
    assert not day.plan.needs_budget_approval


def test_one_place_is_not_used_for_two_steps() -> None:
    script = parse_day_script("coffee then coffee")
    shared = place("the-cafe", ["cafe"], opens="07:00", closes="23:00")
    pools = DayPools()
    pools.places[1] = [PoolEntry(shared)]
    pools.places[2] = [PoolEntry(shared)]
    day = assemble_day(script, constraints_for(script), pools)
    assert statuses(day) == ["filled", "empty"]
    assert day.outcomes[1].reason == "already_in_the_day"


def test_the_same_request_always_gives_the_same_day() -> None:
    script = parse_day_script(USER_EXAMPLE)
    pools = batroun_pools()
    constraints = constraints_for(script)
    first = assemble_day(script, constraints, pools, start_at_first_stop=True)
    second = assemble_day(script, constraints, pools, start_at_first_stop=True)
    assert first.outcomes_json() == second.outcomes_json()


# ---- Gathering pools (retrieval stubbed) ----


@pytest.mark.asyncio
async def test_pools_widen_to_nearby_places_and_mark_them(monkeypatch: pytest.MonkeyPatch) -> None:
    script = parse_day_script("a money changer in Batroun, then bowling in Batroun, then a museum, no seafood")
    constraints = constraints_for(script)
    calls: list[dict[str, Any]] = []
    museum = place("museum", ["museum"])
    fish = place("fish", ["seafood", "museum"])
    lanes = place("jbeil-lanes", ["bowling"], at=(34.12, 35.65))

    async def fake_step(_db: Any, query: dict[str, Any]) -> list[StepCandidate]:
        calls.append(query)
        if "bowling" in query["tags"]:
            return [lanes] if query.get("near") else []
        return [museum, fish]

    async def fake_changers(_db: Any, slug: str) -> list[dict[str, Any]]:
        return [{"id": "office", "lat": 34.25, "lng": 35.66, "destination": {"slug": slug}}]

    monkeypatch.setattr(fill_module, "retrieve_step", fake_step)
    monkeypatch.setattr(fill_module, "retrieve_changers", fake_changers)
    pools = await fill_module.gather_pools(None, script, constraints)  # type: ignore[arg-type]
    assert pools.offices[1][0]["destination"] == {"slug": "batroun"}
    assert [(entry.candidate.slug, entry.outside) for entry in pools.places[2]] == [("jbeil-lanes", True)]
    assert [entry.candidate.slug for entry in pools.places[3]] == ["museum"], "no seafood means no seafood"
    wider = [query for query in calls if query.get("near")]
    assert len(wider) == 1 and wider[0]["destination_slugs"] == []


@pytest.mark.asyncio
async def test_a_day_that_found_nothing_looks_around_the_destination(monkeypatch: pytest.MonkeyPatch) -> None:
    script = parse_day_script("in Batroun: the cinema, then bowling")
    constraints = constraints_for(script)
    screens = place("enfeh-screens", ["cinema"], at=(34.36, 35.73)).model_copy(update={"distance_m": 14_000})
    lanes = place("town-lanes", ["bowling"], at=(34.26, 35.66)).model_copy(update={"distance_m": 900})
    looked_up: list[str] = []

    async def fake_step(_db: Any, query: dict[str, Any]) -> list[StepCandidate]:
        if not query.get("near"):
            return []
        assert query["near"]["lat"] == 34.2553 and query["destination_slugs"] == []
        return [screens] if "cinema" in query["tags"] else [lanes]

    async def fake_point(_db: Any, slug: str) -> tuple[float, float] | None:
        looked_up.append(slug)
        return (34.2553, 35.6581)

    monkeypatch.setattr(fill_module, "retrieve_step", fake_step)
    monkeypatch.setattr(fill_module, "retrieve_destination_point", fake_point)
    pools = await fill_module.gather_pools(None, script, constraints)  # type: ignore[arg-type]
    assert looked_up == ["batroun"]
    assert [(entry.candidate.slug, entry.outside) for entry in pools.places[1]] == [("enfeh-screens", True)]
    assert [(entry.candidate.slug, entry.outside) for entry in pools.places[2]] == [("town-lanes", False)], "in town"


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
async def test_a_day_told_step_by_step_through_the_api(api: AsyncClient) -> None:
    from tests.test_booking_payments import _published_listing

    catalog = await _published_listing(api)  # signed in as the owner, who is also verified
    org_id, listing = catalog["org"]["id"], catalog["listing"]
    typed = await api.put(
        f"/api/v1/venues/portal/{org_id}/listings/{listing['id']}/place-types", json={"place_types": ["escape-room"]}
    )
    assert typed.status_code == 200, typed.text

    response = await api.post(
        "/api/v1/planner/sessions",
        json={"text": "dinner in Beirut then an escape room, then maybe a spa", "locale": "en"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["status"] in {"planned", "infeasible"}
    assert [step["role"] for step in body["day"]] == ["meal", "activity", "activity"]
    assert all(step["status"] in {"filled", "empty", "skipped", "office"} for step in body["day"])
    assert body["day"][2]["status"] in {"filled", "skipped"}, "an optional step is never an error"
    if body["status"] == "planned":
        stops = body["plan"]["stops"]
        filled = [step for step in body["day"] if step["status"] == "filled"]
        assert len(stops) == len(filled)
        assert {str(stop["experience_id"]) for stop in stops} == {step["experience_id"] for step in filled}
        assert all(UUID(step["experience_id"]) for step in filled)
    assert body["llm_never_sets_totals"] is True
    pricing = body["pricing"]
    assert {"low_minor", "high_minor", "lines", "on_request_lines", "budget_status"} <= set(pricing)
    assert all(line["basis"] != "on_request" or line["low_minor"] is None for line in pricing["lines"])
    if body["status"] == "planned":
        ride = await api.post(
            f"/api/v1/planner/sessions/{body['session_id']}/driver-request", json={"pickup_name": "Hotel lobby"}
        )
        assert ride.status_code == 200, ride.text
        assert ride.json()["kind"] == "day"
    assert datetime.fromisoformat(body["constraints"]["return_by"]).astimezone(BEIRUT).time() >= time(23, 0)


@pytest.mark.asyncio
async def test_understand_reads_steps_without_planning(api: AsyncClient) -> None:
    from tests.test_booking_payments import _traveller

    await _traveller(api)
    response = await api.post(
        "/api/v1/planner/understand",
        json={"text": "a driver in Batroun: money changer, then breakfast at a sweets place, then a hotel"},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["plans_as_day"] is True
    assert [step["role"] for step in body["steps"]] == ["exchange", "meal", "stay"]
    assert body["transport"] == "driver" and "constraints" not in body
    anonymous = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    async with anonymous:
        assert (await anonymous.post("/api/v1/planner/understand", json={"text": "museum"})).status_code == 401
