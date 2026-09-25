"""Trip builder v2, phase 1b: candidate phrases, generated spellings, the release gate (migration 050)."""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator, Iterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.mailer import RecordingMailer, set_mailer
from app.core.rate_limit import limiter
from app.main import app
from app.planner.script.learning import CONCEPT_SLUGS, reset_phrases
from app.planner.script.release import measure
from app.planner.script.text import use_extra_phrases
from app.seed.intent_candidates import BLOCKED, build_candidates, reads_as, screen, seed_phrases, spellings

CANDIDATES = Path(__file__).resolve().parents[1] / "app" / "seed" / "data" / "intent_candidates_v1.jsonl"


@pytest.fixture(autouse=True)
def _no_extra_phrases() -> Iterator[None]:
    reset_phrases()
    yield
    reset_phrases()


def test_spellings_follow_how_each_language_is_typed() -> None:
    assert "mit7af" in spellings("mat7af", "arabizi")
    assert not any(" kis" in item or item == "kis" for item in spellings("kes", "arabizi")), "no rude words"
    assert spellings("wine tasting", "arabizi") & {"wene tasting", "wine tasteng"} == set(), (
        "English words inside Arabizi keep their vowels"
    )
    assert "فنجان أهوة" in spellings("فنجان قهوة", "ar-LB"), "Lebanese Arabic writes ق as it is said"
    assert "مقهى" not in spellings("مقهى", "ar") and not any("أ" in item for item in spellings("قمة", "ar")), (
        "Standard Arabic keeps its letters"
    )
    assert spellings("drop us back", "en") == set(), "no plural of a phrase"
    assert "cathedrales" in spellings("cathedrale", "fr")
    assert "boutique" in BLOCKED


def test_candidates_are_new_to_the_reader_and_name_real_concepts() -> None:
    written = [("musée", "museum", "fr"), ("7elwiyet", "sweets", "arabizi"), ("the", "cafe", "fr")]
    rows = build_candidates("test", written, with_cues=False)
    phrases = {row["phrase"] for row in rows}
    assert "7elwiyet" in phrases and "musée" not in phrases, "a phrase the reader already knows adds nothing"
    kept, dropped = screen(rows)
    assert {row["phrase"] for row in dropped} >= {"the"}, "a little word would fire on every request"
    assert all(row["concept"] in CONCEPT_SLUGS for row in kept)
    assert all(row["concept"] not in reads_as(row["phrase"]) for row in kept)


def test_the_candidate_file_is_screened_and_safe_to_approve_whole() -> None:
    rows = [json.loads(line) for line in CANDIDATES.read_text(encoding="utf-8").splitlines()]
    assert len(rows) >= 1500
    assert {row["concept"] for row in rows} <= CONCEPT_SLUGS
    assert {row["source"] for row in rows} <= {"seed", "generated_variant"}
    assert all(row["variant_of"] for row in rows if row["source"] == "generated_variant")
    assert len({(row["phrase"].casefold(), row["concept"]) for row in rows}) == len(rows)
    seeds = {(phrase.casefold(), concept) for phrase, concept, _locale in seed_phrases()}
    assert all((row["phrase"].casefold(), row["concept"]) in seeds for row in rows if row["source"] == "seed")
    # Even if staff approved every single candidate, the reader must stay above the release gate.
    use_extra_phrases(tuple(sorted((row["phrase"], row["concept"]) for row in rows)))
    passes, metrics = measure()
    assert passes, json.dumps(metrics, ensure_ascii=False)[:2000]


def test_the_release_gate_refuses_phrases_that_break_reading() -> None:
    use_extra_phrases((("the", "cafe"),))
    passes, metrics = measure()
    assert not passes and metrics["hand_written"]["case_accuracy"] < 0.9


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
async def test_candidates_are_reviewed_and_released_through_the_api(api: AsyncClient) -> None:
    from tests.test_booking_payments import _published_listing

    await _published_listing(api)  # signed in as the owner, who is also an admin
    batches = await api.get("/api/v1/admin/planner/candidates/batches")
    assert batches.status_code == 200
    page = await api.get("/api/v1/admin/planner/candidates?status=candidate&limit=5")
    assert page.status_code == 200 and {"total", "items"} <= set(page.json())
    bad = await api.post("/api/v1/admin/planner/candidates/review", json={"ids": [], "decision": "approve"})
    assert bad.status_code == 422
    releases = await api.get("/api/v1/admin/planner/releases")
    assert releases.status_code == 200 and "current_checksum" in releases.json()
    released = await api.post("/api/v1/admin/planner/releases", json={"note": "test release"})
    assert released.status_code == 200, released.text
    assert released.json()["name"].startswith("intent-data-v")
    assert released.json()["metrics"]["generated"]["passes"] is True
