"""Opening hours that run past midnight (pure)."""

from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.planner.eligibility import hours_allow
from app.planner.schemas import CandidateRecord

BEIRUT = ZoneInfo("Asia/Beirut")


def _place(opens: str, closes: str) -> CandidateRecord:
    return CandidateRecord.model_validate(
        {
            "id": uuid4(),
            "slug": "bowling",
            "title": "Bowling",
            "status": "published",
            "duration_minutes": 120,
            "destination_slug": "batroun",
            "venue_id": uuid4(),
            "lat": 34.25,
            "lng": 35.65,
            "hours": [{"weekday": day, "opens": opens, "closes": closes} for day in range(7)],
        }
    )


def test_a_late_visit_fits_a_place_that_closes_after_midnight() -> None:
    start = datetime(2026, 9, 26, 21, 0, tzinfo=BEIRUT)
    assert hours_allow(_place("16:00", "01:00"), start, start + timedelta(hours=2)) == (True, "hours_ok")


def test_a_visit_past_the_after_midnight_closing_is_outside_hours() -> None:
    start = datetime(2026, 9, 26, 23, 30, tzinfo=BEIRUT)
    assert hours_allow(_place("16:00", "01:00"), start, start + timedelta(hours=2))[1] == "outside_opening_hours"


def test_a_same_day_closing_still_applies() -> None:
    start = datetime(2026, 9, 26, 17, 0, tzinfo=BEIRUT)
    assert hours_allow(_place("09:00", "18:00"), start, start + timedelta(hours=2))[1] == "outside_opening_hours"
    assert hours_allow(_place("09:00", "18:00"), start - timedelta(hours=8), start)[0] is True
