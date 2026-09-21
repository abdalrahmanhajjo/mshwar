"""Unit tests for the day-feasibility guard (pure — no DB, no provider calls)."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.planner.feasibility import SPREAD_LIMIT_M, FeasibilityReport, assess, day_split, spread_metres, suggest_order
from app.planner.manual import assemble_manual
from app.planner.routing import parse_google_matrix, traffic_params
from app.planner.schemas import CandidateRecord, ExtractedConstraints

BEIRUT = ZoneInfo("Asia/Beirut")

# Real coordinates: the pairing the traveller must be warned about.
SAIDA = (33.5571, 35.3729)
TRIPOLI = (34.4367, 35.8497)
BYBLOS = (34.1230, 35.6480)
BATROUN = (34.2553, 35.6581)


def _candidate(slug: str, coords: tuple[float, float], destination: str, **overrides: object) -> CandidateRecord:
    payload: dict[str, object] = {
        "id": uuid4(),
        "slug": slug,
        "title": slug.replace("-", " ").title(),
        "status": "published",
        "duration_minutes": 90,
        "destination_slug": destination,
        "destination_name": destination.title(),
        "venue_id": uuid4(),
        "lat": coords[0],
        "lng": coords[1],
        "price": {"currency": "USD", "type": "estimated", "amount_minor": 2000, "unit": "person"},
        "hours": [{"weekday": day, "opens": "08:00", "closes": "22:00"} for day in range(7)],
    }
    payload.update(overrides)
    return CandidateRecord.model_validate(payload)


def _constraints(**overrides: object) -> ExtractedConstraints:
    start = datetime(2026, 9, 26, 9, 0, tzinfo=BEIRUT)
    payload: dict[str, object] = {
        "locale": "en",
        "destination_slugs": ["byblos"],
        "party_size": 2,
        "window_start": start,
        "return_by": start + timedelta(hours=10),
        "start_lat": 33.8938,
        "start_lng": 35.5018,
        "currency": "USD",
    }
    payload.update(overrides)
    return ExtractedConstraints.model_validate(payload)


def _assess(picks: list[CandidateRecord], **overrides: object) -> tuple[FeasibilityReport, list[object]]:
    constraints = _constraints(**overrides)
    return assess(picks, assemble_manual(picks, constraints), constraints)


def _codes(report: FeasibilityReport) -> set[str]:
    return {issue.code for issue in report.issues}


def test_saida_and_tripoli_are_not_one_day() -> None:
    picks = [_candidate("saida-souks", SAIDA, "saida"), _candidate("tripoli-citadel", TRIPOLI, "tripoli")]
    report, _timings = _assess(picks, destination_slugs=["saida", "tripoli"])
    assert report.feasible is False
    assert "region_spread" in _codes(report)
    spread, pair = spread_metres(picks)
    assert spread > SPREAD_LIMIT_M
    assert pair is not None and set(pair) == {"Saida Souks", "Tripoli Citadel"}


def test_neighbouring_towns_stay_feasible() -> None:
    picks = [_candidate("byblos-port", BYBLOS, "byblos"), _candidate("batroun-walls", BATROUN, "batroun")]
    report, timings = _assess(picks, destination_slugs=["byblos", "batroun"])
    assert report.feasible is True
    assert "region_spread" not in _codes(report)
    assert [item.destination_slug for item in timings] == ["byblos", "batroun"]
    assert report.destination_slugs == ["byblos", "batroun"]


def test_closed_venue_blocks_the_day() -> None:
    picks = [
        _candidate("byblos-port", BYBLOS, "byblos"),
        _candidate("shut-museum", BATROUN, "batroun", exceptions=[{"local_date": "2026-09-26", "closed": True}]),
    ]
    report, _timings = _assess(picks, destination_slugs=["byblos", "batroun"])
    assert report.feasible is False
    assert "closed_that_day" in _codes(report)


def test_arriving_before_opening_reports_the_wait() -> None:
    picks = [
        _candidate(
            "late-riser",
            BYBLOS,
            "byblos",
            hours=[{"weekday": day, "opens": "16:00", "closes": "22:00"} for day in range(7)],
        )
    ]
    _report, timings = _assess(picks)
    assert timings[0].opens == "16:00"
    assert timings[0].wait_minutes > 45
    assert "long_wait" in timings[0].flags


def test_a_day_of_driving_is_flagged_but_not_blocked() -> None:
    picks = [
        _candidate("byblos-port", BYBLOS, "byblos", duration_minutes=30),
        _candidate("batroun-walls", BATROUN, "batroun", duration_minutes=30),
        _candidate("byblos-souk", BYBLOS, "byblos", duration_minutes=30),
    ]
    start = datetime(2026, 9, 26, 9, 0, tzinfo=BEIRUT)
    report, _timings = _assess(picks, window_start=start, return_by=start + timedelta(hours=4))
    # Half a short day would be spent in the car: worth saying, not worth refusing.
    assert "travel_heavy" in _codes(report)
    assert report.feasible is True
    assert report.travel_minutes > 0
    assert report.travel_distance_m > 0
    assert report.order_saves_minutes > 0


def test_suggested_order_puts_the_furthest_stop_later() -> None:
    ordered = suggest_order(
        [
            _candidate("batroun-walls", BATROUN, "batroun"),
            _candidate("byblos-port", BYBLOS, "byblos"),
            _candidate("byblos-souk", BYBLOS, "byblos"),
        ],
        33.8938,
        35.5018,
    )
    assert ordered[0].slug != "batroun-walls"


def test_day_split_separates_far_apart_picks() -> None:
    picks = [
        _candidate("saida-souks", SAIDA, "saida"),
        _candidate("tripoli-citadel", TRIPOLI, "tripoli"),
        _candidate("byblos-port", BYBLOS, "byblos"),
    ]
    clusters = day_split(picks)
    assert len(clusters) >= 2
    groups = [{candidate.slug for candidate in cluster} for cluster in clusters]
    assert not any({"saida-souks", "tripoli-citadel"} <= group for group in groups)


def test_driving_asks_google_for_traffic() -> None:
    later = datetime.now(BEIRUT) + timedelta(days=3)
    params = traffic_params("driving", later)
    assert params["traffic_model"] == "best_guess"
    assert params["departure_time"].isdigit()
    # A time already past cannot be sent to Google, so we ask for "now" instead.
    assert traffic_params("driving", datetime(2020, 1, 1, tzinfo=BEIRUT))["departure_time"] == "now"
    assert traffic_params("walking", later) == {}


def test_traffic_duration_wins_over_free_flow() -> None:
    payload = {
        "status": "OK",
        "rows": [
            {
                "elements": [
                    {
                        "status": "OK",
                        "distance": {"value": 42000},
                        "duration": {"value": 2400},
                        "duration_in_traffic": {"value": 3300},
                    }
                ]
            }
        ],
    }
    leg = parse_google_matrix(payload, 33.8, 35.5, 34.1, 35.6, "driving", "bucket")
    assert leg.duration_seconds == 3300
    assert leg.traffic_aware is True
    assert leg.traffic_delay_seconds == 900
