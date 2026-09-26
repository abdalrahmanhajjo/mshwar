"""The trip builder resolves places from the catalogue, not a hardcoded list."""

from __future__ import annotations

import httpx
import pytest

from app.core.config import settings
from app.planner.intent.catalogue import VARIANTS, fold, match_destinations
from app.planner.llm import OpenAILLM, ProviderError, build_client, llm_provider_name

# (slug, term, weight) as app.planner_destination_terms() returns them.
TERMS = [
    ("beirut", fold("Beirut").strip(), 3),
    ("beirut", fold("بيروت").strip(), 3),
    ("byblos", fold("Byblos").strip(), 3),
    ("byblos", fold("جبيل").strip(), 3),
    ("qadisha-valley", fold("Vallée de Qadisha").strip(), 3),
    ("qadisha-valley", fold("qadisha valley").strip(), 3),
    ("north-lebanon", fold("North Lebanon").strip(), 1),
    ("north-lebanon", fold("Tripoli Old City").strip(), 2),
    ("south-lebanon", fold("Sidon Sea Castle").strip(), 2),
    ("mount-lebanon", fold("Jeita Grotto").strip(), 2),
]


def test_a_town_the_extractor_never_heard_of_still_resolves() -> None:
    # The old hardcoded alias list knew seven names; "Tripoli" was not one.
    assert match_destinations("A day in Tripoli with my family", TERMS) == ["north-lebanon"]


def test_arabic_and_french_names_resolve_to_the_same_place() -> None:
    assert match_destinations("بدي يوم بطرابلس", TERMS) == ["north-lebanon"]
    assert match_destinations("Une journée dans la Vallée de Qadisha", TERMS) == ["qadisha-valley"]
    # Written without the accents, as people type it.
    assert match_destinations("vallee de qadisha", TERMS) == ["qadisha-valley"]


def test_a_place_inside_a_destination_names_that_destination() -> None:
    assert match_destinations("I want to see the Sidon Sea Castle", TERMS) == ["south-lebanon"]
    assert match_destinations("Jeita Grotto then lunch", TERMS) == ["mount-lebanon"]


def test_transliteration_variants_reach_the_catalogue_spelling() -> None:
    # "Saida" is never stored; the catalogue says "Sidon". Both must work.
    assert match_destinations("a day in Saida", TERMS) == ["south-lebanon"]
    assert match_destinations("jbeil for two", TERMS) == ["byblos"]
    assert "sidon" in VARIANTS["saida"]


def test_several_towns_in_one_sentence_all_resolve() -> None:
    resolved = match_destinations("Byblos and Beirut in one day", TERMS)
    assert set(resolved) == {"byblos", "beirut"}


def test_a_named_place_beats_the_region_it_sits_in() -> None:
    # Both terms match; the more specific one leads.
    assert match_destinations("Tripoli Old City, North Lebanon", TERMS)[0] == "north-lebanon"


def test_naming_no_place_invents_none() -> None:
    assert match_destinations("something nice outdoors", TERMS) == []
    assert match_destinations("", TERMS) == []


def test_a_kind_of_place_is_never_read_as_a_place_name() -> None:
    # Only one destination has a place called "... Bowling"; "play bowling" still names no destination.
    terms = [*TERMS, ("north-lebanon", fold("Las Salinas Bowling").strip(), 2)]
    assert match_destinations("then play bowling", terms) == []
    assert match_destinations("bowling at las salinas", terms) == ["north-lebanon"]


def test_a_substring_of_a_longer_word_is_not_a_match() -> None:
    # "beirut" inside "beirutish" is not the traveller naming Beirut.
    assert match_destinations("beirutish vibes", TERMS) == []


def test_provider_is_the_stub_until_a_credential_is_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "", raising=False)
    monkeypatch.setattr(settings, "planner_llm_provider", "openai", raising=False)
    assert llm_provider_name() == "stub"
    assert build_client().inner.__class__.__name__ == "StubLLM"


def test_a_configured_credential_actually_reaches_the_model(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "openai_api_key", "sk-test", raising=False)
    monkeypatch.setattr(settings, "planner_llm_provider", "openai", raising=False)
    assert llm_provider_name() == "openai"
    assert build_client().inner.__class__.__name__ == "OpenAILLM"
    # A responder (tests, evals) still short-circuits the network.
    assert build_client(responder=lambda *_: "{}").inner.__class__.__name__ == "StubLLM"


def test_the_model_reply_is_unwrapped_and_failures_become_provider_errors() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer sk-test"
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"party_size": 2}'}}]})

    client = OpenAILLM("sk-test", "gpt-4o-mini", 5.0, transport=httpx.MockTransport(handler))
    assert client.complete("prompt", "extract") == '{"party_size": 2}'

    down = OpenAILLM(
        "sk-test",
        "gpt-4o-mini",
        5.0,
        transport=httpx.MockTransport(lambda _request: httpx.Response(503)),
    )
    with pytest.raises(ProviderError):
        down.complete("prompt", "extract")

    empty = OpenAILLM(
        "sk-test",
        "gpt-4o-mini",
        5.0,
        transport=httpx.MockTransport(lambda _r: httpx.Response(200, json={"choices": []})),
    )
    with pytest.raises(ProviderError):
        empty.complete("prompt", "extract")
