"""Trip builder v2, phase 6: edit a day step by step; learn from what travellers ask for, safely."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator, Iterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from app.planner.day_session import current_places, record_gaps
from app.planner.defaults import apply_defaults
from app.planner.script import parse_day_script
from app.planner.script.day import DayPools, assemble_day
from app.planner.script.learning import CONCEPT_SLUGS, redact, reset_phrases
from app.planner.script.patch import patch_day
from app.planner.script.text import use_extra_phrases

DAY = parse_day_script(
    "money changer, then breakfast at a sweets place, then a mountain, then dinner, then bowling, "
    "then cinema, then a hotel"
)


@pytest.fixture(autouse=True)
def _no_extra_phrases() -> Iterator[None]:
    reset_phrases()
    yield
    reset_phrases()


def shape(script: Any) -> list[str]:
    return [f"{step.role}:{step.meal or ','.join(step.tags)}" for step in script.steps]


# ---- Step edits ----


@pytest.mark.parametrize(
    ("edit", "expected"),
    [
        ("swap bowling for karting", "activity:karting"),
        ("karting instead of bowling", "activity:karting"),
        ("بدل البولينغ بكارتينغ", "activity:karting"),
        ("remplace le bowling par du karting", "activity:karting"),
    ],
)
def test_a_step_can_be_swapped_in_every_language(edit: str, expected: str) -> None:
    result = patch_day(DAY, edit)
    assert result.understood, result.not_understood
    assert shape(result.script)[4] == expected
    assert len(result.script.steps) == len(DAY.steps)


def test_a_step_can_be_moved_before_or_after_another() -> None:
    moved = patch_day(DAY, "move the cinema before dinner").script
    assert shape(moved)[3:6] == ["activity:cinema", "meal:dinner", "activity:bowling"]
    later = patch_day(DAY, "put breakfast after the mountain").script
    assert shape(later)[1:3] == ["sight:mountain", "meal:breakfast"]


def test_steps_can_be_added_and_removed() -> None:
    added = patch_day(DAY, "add lunch after the mountain").script
    assert shape(added)[3] == "meal:lunch" and len(added.steps) == 8
    at_end = patch_day(DAY, "add a museum").script
    assert shape(at_end)[-2:] == ["sight:museum", "stay:hotel"], "a new step goes before the night away"
    no_night = patch_day(DAY, "remove the hotel").script
    assert "stay:hotel" not in shape(no_night) and no_night.ends_overnight is False
    arabizi = patch_day(DAY, "shil el cinema").script
    assert "activity:cinema" not in shape(arabizi)


def test_several_edits_apply_together_and_orders_stay_1_to_n() -> None:
    result = patch_day(DAY, "karting instead of bowling, remove the hotel; add a museum after dinner")
    assert result.understood
    assert shape(result.script) == [
        "exchange:money-changer",
        "meal:breakfast",
        "sight:mountain",
        "meal:dinner",
        "sight:museum",
        "activity:karting",
        "activity:cinema",
    ]
    assert [step.order for step in result.script.steps] == list(range(1, 8))
    assert "bowling → karting" in result.summary


def test_an_edit_that_matches_no_step_changes_nothing() -> None:
    for edit in ("remove the zoo", "move dinner after the space station", "make it nicer"):
        result = patch_day(DAY, edit)
        assert not result.understood and result.script is DAY
    partly = patch_day(DAY, "remove the hotel, remove the zoo")
    assert not partly.understood and partly.not_understood == ["remove the zoo"]


def test_a_day_never_grows_past_twelve_steps() -> None:
    big = parse_day_script(", ".join(["museum", "church", "castle", "souk", "beach", "gallery"] * 2))
    assert len(big.steps) == 12
    result = patch_day(big, "add a spa")
    assert not result.understood and "at most 12" in result.not_understood[0]


# ---- Learning, safely ----


def test_redaction_removes_contacts_numbers_and_names() -> None:
    assert redact("call me on +961 3 123 456 please") == "call me on please"
    assert redact("mail rana@example.com the plan") == "mail the plan"
    assert redact("see www.example.com tonight") == "see tonight"
    assert redact("because my son Tony is sick") == "because my son … is sick"
    assert redact("Tony") is None
    assert redact("") is None


def test_approved_phrases_extend_what_the_planner_reads() -> None:
    assert parse_day_script("7elwe then zawarib").steps == parse_day_script("7elwe then zawarib").steps
    before = parse_day_script("zawarib walk then dinner")
    assert [step.role for step in before.steps] == ["meal"]
    use_extra_phrases((("zawarib", "old-town"),))
    after = parse_day_script("zawarib walk then dinner")
    assert [(step.role, step.tags) for step in after.steps] == [("sight", ["old-town"]), ("meal", [])]
    use_extra_phrases((("zawarib", "no-such-concept"),))
    assert [step.role for step in parse_day_script("zawarib walk then dinner").steps] == ["meal"]
    assert {"old-town", "meal-breakfast", "exchange", "overnight"} <= CONCEPT_SLUGS


class _Recorder:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def execute(self, statement: Any, params: dict[str, Any]) -> None:
        self.calls.append((str(statement), params))


@pytest.mark.asyncio
async def test_unfilled_steps_are_counted_by_kind_only() -> None:
    script = parse_day_script("breakfast in Batroun, then bowling, then a museum")
    constraints, _assumed = apply_defaults(script.constraints)
    day = assemble_day(script, constraints, DayPools())
    recorder = _Recorder()
    await record_gaps(recorder, script, day)  # type: ignore[arg-type]
    ((_sql, params),) = recorder.calls
    gaps = json.loads(params["gaps"])
    assert [(gap["role"], gap["tags"], gap["destination_slug"]) for gap in gaps] == [
        ("meal", [], "batroun"),
        ("activity", ["bowling"], "batroun"),
        ("sight", ["museum"], "batroun"),
    ]
    assert all(set(gap) == {"destination_slug", "role", "tags", "meal", "reason"} for gap in gaps), "no words kept"


def test_current_places_reads_the_saved_day() -> None:
    version = {
        "constraints": {
            "day": [
                {"order": 1, "status": "office"},
                {"order": 2, "status": "filled", "experience_id": "3f1f8a5e-4a44-4c5b-9a5e-1b1c1d1e1f10"},
                {"order": 3, "status": "empty"},
            ]
        }
    }
    assert list(current_places(version)) == [(1, 2)]
    assert current_places(None) == {}


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
async def test_a_day_is_edited_step_by_step_through_the_api(api: AsyncClient) -> None:
    from tests.test_booking_payments import _published_listing

    catalog = await _published_listing(api)
    org_id, listing = catalog["org"]["id"], catalog["listing"]
    await api.put(
        f"/api/v1/venues/portal/{org_id}/listings/{listing['id']}/place-types", json={"place_types": ["escape-room"]}
    )
    created = await api.post(
        "/api/v1/planner/sessions", json={"text": "an escape room in Beirut, then bowling", "locale": "en"}
    )
    assert created.status_code == 200, created.text
    session_id = created.json()["session_id"]

    preview = await api.post(
        f"/api/v1/planner/sessions/{session_id}/refine", json={"text": "remove the bowling", "apply": False}
    )
    assert preview.status_code == 200, preview.text
    if created.json()["status"] == "planned":
        body = preview.json()
        assert body["understood"] is True and body["kind"] == "day_patch"
        assert [step["role"] for step in body["steps"]] == ["activity"]
        applied = await api.post(
            f"/api/v1/planner/sessions/{session_id}/refine", json={"text": "remove the bowling", "apply": True}
        )
        assert applied.status_code == 200, applied.text
        assert [step["role"] for step in applied.json()["day"]] == ["activity"]

        options = await api.get(f"/api/v1/planner/sessions/{session_id}/steps/1/alternatives")
        assert options.status_code == 200
        assert all(option["price"]["basis"] for option in options.json())
        bogus = await api.post(
            f"/api/v1/planner/sessions/{session_id}/steps/1/choose",
            json={"experience_id": "3f1f8a5e-4a44-4c5b-9a5e-1b1c1d1e1f10"},
        )
        assert bogus.status_code == 422, "only a trusted option for this step can be chosen"
        regenerated = await api.post(f"/api/v1/planner/sessions/{session_id}/regenerate")
        assert regenerated.status_code == 200, regenerated.text
        assert "day" in regenerated.json()

    gaps = await api.get("/api/v1/admin/planner/gaps?days=7")
    assert gaps.status_code == 200
    concepts = await api.get("/api/v1/admin/planner/concepts")
    assert {"slug", "kind", "role", "example"} <= set(concepts.json()[0])
    bad = await api.post("/api/v1/admin/planner/phrases", json={"phrase": "zawarib", "concept": "not-a-concept"})
    assert bad.status_code == 422
    added = await api.post("/api/v1/admin/planner/phrases", json={"phrase": "zawarib", "concept": "old-town"})
    assert added.status_code == 200, added.text
    understood = await api.post("/api/v1/planner/understand", json={"text": "zawarib walk then dinner"})
    assert [step["role"] for step in understood.json()["steps"]] == ["sight", "meal"]
    await api.post(f"/api/v1/admin/planner/phrases/{added.json()['id']}/retire")
