"""Trip builder v2, layer L4: suggestions for wording the reader could not read. Offered, never applied."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest

from app.planner.script import parse_day_script, script_questions
from app.planner.script.learning import CONCEPT_SLUGS
from app.planner.script.meaning import ASSOCIATIONS, Suggestion, suggest, use_matcher, word_for

FIXTURES = Path(__file__).resolve().parents[1] / "app" / "planner" / "script" / "fixtures"


@pytest.fixture(autouse=True)
def _default_matcher() -> Iterator[None]:
    use_matcher(None)
    yield
    use_matcher(None)


def _score(name: str) -> tuple[float, float, int, int]:
    cases = json.loads((FIXTURES / name).read_text(encoding="utf-8"))["cases"]
    unread = [case for case in cases if not parse_day_script(case["text"]).steps]
    real = [case for case in unread if case["concept"] != "none"]
    none = [case for case in unread if case["concept"] == "none"]
    ranked = {case["text"]: [item.concept for item in suggest(case["text"])] for case in unread}
    top1 = sum(1 for case in real if ranked[case["text"]][:1] == [case["concept"]]) / len(real)
    top3 = sum(1 for case in real if case["concept"] in ranked[case["text"]]) / len(real)
    false = sum(1 for case in none if ranked[case["text"]])
    return top1, top3, false, len(real)


def test_suggestions_on_wording_written_after_the_matcher_was_frozen() -> None:
    top1, top3, false, count = _score("paraphrases_holdout.json")
    assert count >= 50
    assert top1 >= 0.85 and top3 >= 0.95, (top1, top3)
    assert false == 0, "words that mean nothing to do get no suggestion"


def test_suggestions_on_the_set_the_associations_were_written_against() -> None:
    top1, top3, false, count = _score("paraphrases.json")
    assert count >= 80 and top1 >= 0.9 and top3 >= 0.98 and false == 0


def test_only_steps_are_suggested_and_every_association_names_a_concept() -> None:
    assert set(ASSOCIATIONS) <= CONCEPT_SLUGS
    ranked = [item.concept for item in suggest("see what's showing tonight")]
    assert ranked[0] == "cinema" and "time-night" not in ranked
    assert [item.concept for item in suggest("somewhere to knock down some pins")] == ["bowling"]
    assert suggest("somewhere to knock down some pins")[0].because == ("pins",)


def test_a_suggestion_is_a_question_with_taps_never_a_step() -> None:
    script = parse_day_script("breakfast, then somewhere to knock down some pins")
    assert [step.role for step in script.steps] == ["meal"], "the reader still never guesses"
    (question,) = [item for item in script_questions(script) if item.field == "unparsed"]
    assert question.options == ["bowling"] and "did you mean bowling" in question.prompt
    plain = script_questions(parse_day_script("breakfast, then call my mother about it"))
    assert all(not item.options for item in plain)


def test_a_tapped_suggestion_writes_a_word_the_reader_knows() -> None:
    for concept in ASSOCIATIONS:
        script = parse_day_script(f"breakfast, then {word_for(concept)}")
        assert len(script.steps) == 2 and not script.unparsed, concept


def test_another_matcher_can_be_plugged_in() -> None:
    class Fixed:
        def suggest(self, fragment: str) -> list[Suggestion]:
            return [Suggestion(concept="museum", score=9.0, because=(fragment,))]

    use_matcher(Fixed())
    assert suggest("anything")[0].concept == "museum"
