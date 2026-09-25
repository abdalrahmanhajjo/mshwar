"""Trip builder v2, phase 1: reading a whole day from free text (no database needed)."""

from __future__ import annotations

import json
from collections.abc import Iterator
from datetime import time

import pytest
from pydantic import ValidationError

from app.core.config import settings
from app.planner.circuit import reset_circuit
from app.planner.fixtures import data_prompt, stub_response
from app.planner.llm import build_client
from app.planner.schemas import DayScript, StepSpec
from app.planner.script import parse_day_script, read_day_script, script_questions
from app.planner.script.evaluation import evaluate
from app.planner.script.generated_eval import FIXTURE_PATH as GENERATED_FIXTURE, build as build_generated
from app.planner.script.text import split_clauses, token_forms, words
from app.planner.script.vocabulary import ALL_CONCEPTS, STEP_TAGS, arabizi_variants

USER_EXAMPLE = (
    "I want to get driver in batroun to go trip start currency changer then pass me at place do breakfast "
    "at sweat place then go see a mountain then after that eat dinner and after it play bowling then  watch "
    "film at cinema and finally stay night at hotel"
)


@pytest.fixture(autouse=True)
def _clean_provider_state() -> Iterator[None]:
    reset_circuit()
    previous = settings.planner_fault_inject
    yield
    settings.planner_fault_inject = previous
    reset_circuit()


def _roles(script: DayScript) -> list[str]:
    return [step.role for step in script.steps]


# ---- The eval set (release gate) ----


def test_eval_set_meets_the_release_gate() -> None:
    report, threshold = evaluate(lambda prompt, locale: parse_day_script(prompt, locale))
    assert report.cases >= 50
    assert report.case_accuracy >= threshold, "\n".join(report.failures)
    assert report.step_accuracy >= 0.92, "\n".join(report.failures)
    assert report.order_accuracy >= 0.95, "\n".join(report.failures)


def test_the_generated_eval_set_meets_the_release_gate() -> None:
    """1,200 template-built prompts (en, ar-LB, Arabizi, fr, mixed): lists, arrows, typos, drivers, parties."""
    report, threshold = evaluate(lambda prompt, locale: parse_day_script(prompt, locale), GENERATED_FIXTURE)
    assert report.cases >= 1000
    assert report.case_accuracy >= threshold, "\n".join(report.failures[:20])
    assert report.step_accuracy >= 0.92 and report.order_accuracy >= 0.95, "\n".join(report.failures[:20])


def test_the_generated_fixture_matches_its_generator() -> None:
    assert json.loads(GENERATED_FIXTURE.read_text(encoding="utf-8")) == build_generated(), (
        "run: python scripts/build_generated_eval.py"
    )


def test_typos_are_read_but_other_words_are_not() -> None:
    assert _roles(parse_day_script("musuem then dinnre")) == ["sight", "meal"]
    assert parse_day_script("an ecsape room then wine tsating").steps[1].tags == ["winery"]
    assert _roles(parse_day_script("a bench then dinner")) == ["meal"], "a different letter is not a typo"


def test_party_size_and_arabizi_negation() -> None:
    for prompt in ("we are 4, museum then dinner", "nous sommes 4 : musee puis diner", "نحنا 4 متحف بعدين عشا"):
        assert parse_day_script(prompt).constraints.party_size == 4, prompt
    script = parse_day_script("bade 3asha w ma bade samak")
    assert script.avoid_tags == ["seafood"] and script.steps[0].tags == []
    assert parse_day_script("avec ma famille diner").avoid_tags == [], "French 'ma' is not a no"
    next_to = parse_day_script("a cafe next to the beach")
    assert _roles(next_to) == ["meal"] and "sea-view" in next_to.steps[0].tags, '"next to" is not "then"'


def test_the_batroun_day_reads_in_order() -> None:
    script = parse_day_script(USER_EXAMPLE)
    assert _roles(script) == ["exchange", "meal", "sight", "meal", "activity", "activity", "stay"]
    breakfast = script.steps[1]
    assert breakfast.meal == "breakfast" and "sweets" in breakfast.tags
    assert script.steps[2].tags == ["mountain"]
    assert script.steps[3].meal == "dinner"
    assert [step.tags for step in script.steps[4:6]] == [["bowling"], ["cinema"]]
    assert script.transport == "driver"
    assert script.pickup_requested is True
    assert script.ends_overnight is True
    assert script.constraints.destination_slugs == ["batroun"]
    assert [step.order for step in script.steps] == list(range(1, 8))


# ---- Schema guarantees ----


def test_step_drops_unknown_tags_and_rejects_unknown_roles() -> None:
    step = StepSpec(order=1, role="activity", tags=["bowling", "free-drinks", "bowling"])
    assert step.tags == ["bowling"]
    with pytest.raises(ValidationError):
        StepSpec(order=1, role="booking")
    with pytest.raises(ValidationError):
        StepSpec(order=1, role="meal", meal="midnight-feast")


def test_day_script_rejects_extra_keys_a_model_might_add() -> None:
    with pytest.raises(ValidationError):
        DayScript.model_validate({"steps": [], "total_minor": 100})
    with pytest.raises(ValidationError):
        DayScript.model_validate({"steps": [{"order": 1, "role": "meal", "experience_id": "x"}]})


def test_a_stay_always_ends_the_day_and_orders_are_renumbered() -> None:
    script = DayScript(
        steps=[
            StepSpec(order=1, role="stay", tags=["hotel"]),
            StepSpec(order=5, role="meal", meal="dinner"),
            StepSpec(order=9, role="activity", tags=["cinema"]),
        ]
    )
    assert _roles(script) == ["meal", "activity", "stay"]
    assert [step.order for step in script.steps] == [1, 2, 3]
    assert script.ends_overnight is True


# ---- Vocabulary and text ----


def test_vocabulary_is_well_formed() -> None:
    slugs = [concept.slug for concept in ALL_CONCEPTS]
    assert len(slugs) == len(set(slugs))
    assert all(concept.cues for concept in ALL_CONCEPTS)
    assert {"sweets", "mountain", "bowling", "cinema", "hotel", "money-changer", "sea-view"} <= STEP_TAGS


def test_arabizi_variants_cover_common_spellings() -> None:
    variants = arabizi_variants("terwi2a")
    assert {"terwi2a", "terwia", "terwi'a"} <= variants
    assert "7elweyet" in arabizi_variants("7elweyet") and "helweyet" in arabizi_variants("7elweyet")
    assert arabizi_variants("cinema") == {"cinema"}


def test_arabic_proclitics_are_peeled() -> None:
    assert "سينما" in token_forms("وبالسينما")
    assert "بحر" in token_forms("عالبحر")


def test_clauses_split_on_sequence_words_in_every_language() -> None:
    assert split_clauses("coffee, then museum -> lunch") == ["coffee", "museum", "lunch"]
    assert split_clauses("عشا بعدين بولينغ") == ["عشا", "بولينغ"]
    assert split_clauses("musée puis déjeuner et enfin hôtel") == ["musée", "déjeuner", "hôtel"]
    assert len(split_clauses("breakfast at 8.30 then lunch")) == 2


def test_longer_phrases_win_over_shorter_ones() -> None:
    assert parse_day_script("a bed and breakfast").steps[0].role == "stay"
    assert parse_day_script("صراف آلي").steps[0].tags == ["atm"]
    assert parse_day_script("صراف").steps[0].role == "exchange"


def test_typos_are_read_but_ordinary_words_are_not_turned_into_places() -> None:
    assert parse_day_script("bowlling then resturant").steps[0].tags == ["bowling"]
    assert _roles(parse_day_script("no driving, just the museum")) == ["sight"]
    assert "diving" not in parse_day_script("no driving, just the museum").avoid_tags


# ---- Order, time and the shape of the day ----


def test_before_everything_moves_a_step_to_the_start() -> None:
    script = parse_day_script("dinner then cinema. before all of that a money changer")
    assert _roles(script) == ["exchange", "meal", "activity"]


def test_after_a_meal_that_was_not_asked_for_is_a_moment_not_a_stop() -> None:
    script = parse_day_script("after lunch, the museum")
    assert _roles(script) == ["sight"]
    assert script.start_time == time(14, 0)
    assert script.steps[0].time_of_day == "afternoon"


def test_times_follow_the_part_of_the_day() -> None:
    script = parse_day_script("breakfast at 9, then dinner at 8, then a club at 11pm")
    assert [step.at for step in script.steps] == [time(9, 0), time(20, 0), time(23, 0)]


def test_numbers_that_are_not_times_are_ignored() -> None:
    script = parse_day_script("lunch at 2 people, museum for 3 hours")
    assert script.steps[0].at is None
    assert script.steps[1].duration_minutes == 180


def test_negation_excludes_instead_of_adding() -> None:
    script = parse_day_script("lunch, then the beach, and no hotel")
    assert _roles(script) == ["meal", "sight"]
    assert "hotel" in script.avoid_tags
    assert script.ends_overnight is False


def test_a_place_name_is_kept_but_never_trusted() -> None:
    script = parse_day_script("dinner at Tawlet Souk el Tayeb, then the Corniche")
    assert script.steps[0].named_place == "Tawlet Souk el Tayeb"
    assert script.steps[1].role == "sight" and script.steps[1].named_place == "Corniche"


def test_what_cannot_be_read_is_reported_not_guessed() -> None:
    script = parse_day_script("something fun with friends")
    assert script.steps == []
    assert script.unparsed == ["something fun with friends"]
    questions = script_questions(script)
    assert [question.field for question in questions] == ["unparsed", "intent_anchor"]


def test_catalogue_terms_name_destinations_per_step() -> None:
    terms = [("tyre", "tyre", 3), ("tyre", "sour", 2), ("sidon", "sidon", 3)]
    script = parse_day_script("breakfast in Sour, then the sea castle in Sidon", terms=terms)
    assert [step.destination_slug for step in script.steps] == ["tyre", "sidon"]
    assert script.constraints.destination_slugs[:2] == ["tyre", "sidon"]


def test_dietary_and_access_needs_are_day_wide() -> None:
    script = parse_day_script("vegan lunch then a museum, my father uses a wheelchair")
    assert script.constraints.dietary == ["vegan"]
    assert script.constraints.accessibility == ["wheelchair"]


def test_too_many_steps_are_capped() -> None:
    script = parse_day_script(", ".join(["museum", "church", "castle", "souk", "beach"] * 3))
    assert len(script.steps) == 12


def test_words_fold_like_catalogue_names() -> None:
    assert words("Pâtisserie, BAKERY!") == ["patisserie", "bakery"]


# ---- The model path and its fallback ----


def test_model_output_is_used_when_it_validates() -> None:
    reply = DayScript(steps=[StepSpec(order=1, role="activity", tags=["bowling"])]).model_dump_json()
    script, degraded = read_day_script("bowling", client=build_client(lambda _prompt, _schema: reply))
    assert degraded is False
    assert _roles(script) == ["activity"]
    assert script.constraints.query == "bowling"


def test_provider_down_falls_back_to_the_parser() -> None:
    settings.planner_fault_inject = "provider_down"
    script, degraded = read_day_script(USER_EXAMPLE)
    assert degraded is True
    assert len(script.steps) == 7


def test_invalid_model_output_falls_back_after_one_repair() -> None:
    calls: list[str] = []

    def responder(prompt: str, _schema: str) -> str:
        calls.append(prompt)
        return json.dumps({"steps": [{"order": 1, "role": "meal", "price": 12}]})

    script, degraded = read_day_script("dinner then cinema", client=build_client(responder))
    assert degraded is True
    assert len(calls) == settings.planner_llm_max_attempts
    assert _roles(script) == ["meal", "activity"]


def test_a_model_that_finds_nothing_does_not_override_the_parser() -> None:
    empty = DayScript().model_dump_json()
    script, degraded = read_day_script("dinner then cinema", client=build_client(lambda _p, _s: empty))
    assert degraded is True
    assert _roles(script) == ["meal", "activity"]


def test_the_stub_provider_reads_days_like_the_parser() -> None:
    payload = json.loads(stub_response(data_prompt("day_script", "عشا بعدين بولينغ"), "day_script"))
    assert [step["role"] for step in payload["steps"]] == ["meal", "activity"]
    script, degraded = read_day_script("عشا بعدين بولينغ", locale="ar-LB")
    assert degraded is False
    assert script.constraints.locale == "ar-LB"
