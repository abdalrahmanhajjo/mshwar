"""A large eval set built from templates, so every label is right by construction.

The hand-written eval set (``fixtures/day_scripts.json``) holds real-looking
requests, written and checked by people. This one scales it: each prompt is
put together from step phrases whose meaning is known (a meal, a kind of
place), joined with the words travellers use for "then", in English, Lebanese
Arabic, Arabizi, French and a mix. Because a prompt is built from its labels,
the labels cannot be wrong, so the set needs no review to be trusted as a test.

It does not replace review of *phrases* (``app.intent_phrases``): nothing here
changes what the planner reads; it only measures it.

Regenerate the fixture with ``python scripts/build_generated_eval.py``; a test
checks the file matches this code.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from pathlib import Path
from typing import Any

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "day_scripts_generated.json"
SEED = 20260925
DEFAULT_COUNT = 1200
LOCALES = ("en", "ar-LB", "arabizi", "fr", "mixed")


@dataclass(frozen=True)
class Step:
    """One step a prompt can ask for: what it means, and how each locale says it."""

    key: str
    role: str
    surfaces: dict[str, tuple[str, ...]]
    tag: str | None = None
    meal: str | None = None
    #: Night steps close the day; at most one, always last.
    last: bool = False

    def expected(self) -> dict[str, Any]:
        spec: dict[str, Any] = {"role": self.role}
        if self.meal:
            spec["meal"] = self.meal
        if self.tag:
            spec["tags"] = [self.tag]
        return spec


def _s(
    key: str,
    role: str,
    *,
    tag: str | None = None,
    meal: str | None = None,
    last: bool = False,
    **surfaces: tuple[str, ...],
) -> Step:
    by_locale = {locale.replace("_", "-"): value for locale, value in surfaces.items()}
    return Step(key=key, role=role, tag=tag, meal=meal, last=last, surfaces=by_locale)


STEPS: tuple[Step, ...] = (
    # ---- Meals ----
    _s(
        "breakfast",
        "meal",
        meal="breakfast",
        en=("breakfast", "have breakfast", "grab breakfast", "a quick breakfast"),
        ar_LB=("ترويقة", "نترويق", "فطور"),
        arabizi=("terwi2a", "tarwi2a", "ftour"),
        fr=("petit dejeuner", "un petit-déjeuner"),
    ),
    _s(
        "lunch",
        "meal",
        meal="lunch",
        en=("lunch", "have lunch", "grab some lunch"),
        ar_LB=("غدا", "نتغدى", "الغدا"),
        arabizi=("ghada", "8ada"),
        fr=("dejeuner", "le déjeuner"),
    ),
    _s(
        "dinner",
        "meal",
        meal="dinner",
        en=("dinner", "have dinner", "eat dinner", "a nice dinner"),
        ar_LB=("عشا", "نتعشى", "العشا"),
        arabizi=("3asha", "3ashe"),
        fr=("diner", "le dîner", "souper"),
    ),
    _s(
        "sweets-breakfast",
        "meal",
        tag="sweets",
        meal="breakfast",
        en=("breakfast at a sweets place", "knefeh for breakfast", "breakfast at a sweet shop"),
        ar_LB=("ترويقة كنافة", "فطور حلويات"),
        arabizi=("terwi2a knefeh",),
        fr=("petit dejeuner patisserie",),
    ),
    _s(
        "seafood-dinner",
        "meal",
        tag="seafood",
        meal="dinner",
        en=("seafood dinner", "dinner with fish", "a fish dinner"),
        ar_LB=("عشا سمك",),
        arabizi=("3asha samak",),
        fr=("diner fruits de mer", "diner poisson"),
    ),
    _s(
        "mezze-lunch",
        "meal",
        tag="mezze",
        meal="lunch",
        en=("lunch with mezze", "lebanese food for lunch", "mezze lunch"),
        ar_LB=("غدا مازة",),
        arabizi=("ghada mezze",),
        fr=("dejeuner cuisine libanaise",),
    ),
    _s(
        "coffee",
        "meal",
        tag="cafe",
        en=("coffee", "a coffee", "coffee at a cafe"),
        ar_LB=("قهوة",),
        arabizi=("2ahwe", "ahwe"),
        fr=("un cafe",),
    ),
    _s(
        "ice-cream",
        "meal",
        tag="ice-cream",
        en=("ice cream", "gelato"),
        ar_LB=("بوظة",),
        arabizi=("bouza",),
        fr=("une glace",),
    ),
    _s(
        "manakish",
        "meal",
        tag="manakish",
        en=("manakish", "manousheh"),
        ar_LB=("منقوشة", "مناقيش"),
        arabizi=("man2oushe", "mana2ish"),
        fr=("manakish",),
    ),
    # ---- Sights ----
    _s(
        "mountain",
        "sight",
        tag="mountain",
        en=("see a mountain", "go to the mountains", "the mountain", "a mountain view"),
        ar_LB=("الجبل", "نطلع عالجبل"),
        arabizi=("jabal", "el jabal"),
        fr=("la montagne", "voir la montagne"),
    ),
    _s(
        "beach",
        "sight",
        tag="beach",
        en=("the beach", "go to the beach", "swim at the beach"),
        ar_LB=("البحر", "نسبح بالبحر"),
        arabizi=("bahr", "ba7r"),
        fr=("la plage", "aller à la plage"),
    ),
    _s(
        "museum",
        "sight",
        tag="museum",
        en=("a museum", "visit the museum", "the museum"),
        ar_LB=("المتحف", "متحف"),
        arabizi=("mat7af",),
        fr=("un musée", "visiter le musee"),
    ),
    _s(
        "castle",
        "sight",
        tag="castle",
        en=("the castle", "visit the citadel", "the old castle"),
        ar_LB=("القلعة",),
        arabizi=("2al3a",),
        fr=("le chateau", "le château"),
    ),
    _s(
        "ruins",
        "sight",
        tag="ruins",
        en=("the ruins", "the roman ruins", "see the ancient ruins"),
        ar_LB=("الآثار", "اثار"),
        arabizi=("athar",),
        fr=("les ruines",),
    ),
    _s(
        "cave",
        "sight",
        tag="cave",
        en=("the cave", "visit the grotto"),
        ar_LB=("المغارة",),
        arabizi=("maghara",),
        fr=("la grotte",),
    ),
    _s(
        "waterfall",
        "sight",
        tag="waterfall",
        en=("a waterfall", "see the waterfall"),
        ar_LB=("الشلال",),
        arabizi=("shallal",),
        fr=("la cascade",),
    ),
    _s(
        "souk",
        "sight",
        tag="souk",
        en=("the souk", "walk in the old souk"),
        ar_LB=("السوق",),
        arabizi=("souk",),
        fr=("le souk",),
    ),
    _s(
        "church",
        "sight",
        tag="church",
        en=("a church", "visit the church"),
        ar_LB=("الكنيسة",),
        arabizi=("kanise",),
        fr=("une église", "l'eglise"),
    ),
    _s(
        "cedars",
        "sight",
        tag="cedars",
        en=("the cedars", "see the cedar forest"),
        ar_LB=("الأرز",),
        arabizi=("arz", "el arz"),
        fr=("les cèdres",),
    ),
    _s(
        "sunset",
        "sight",
        tag="sunset",
        en=("watch the sunset", "the sunset"),
        ar_LB=("الغروب",),
        arabizi=("ghroub",),
        fr=("le coucher de soleil",),
    ),
    # ---- Activities ----
    _s(
        "bowling",
        "activity",
        tag="bowling",
        en=("bowling", "play bowling", "go bowling"),
        ar_LB=("بولينغ", "نلعب بولينغ"),
        arabizi=("bowling",),
        fr=("un bowling", "jouer au bowling"),
    ),
    _s(
        "cinema",
        "activity",
        tag="cinema",
        en=("the cinema", "watch a film at the cinema", "a movie", "catch a movie"),
        ar_LB=("السينما", "فيلم بالسينما"),
        arabizi=("sinama",),
        fr=("le cinéma", "voir un film au cinema"),
    ),
    _s(
        "karting",
        "activity",
        tag="karting",
        en=("karting", "go karting"),
        ar_LB=("كارتينغ",),
        arabizi=("karting",),
        fr=("du karting",),
    ),
    _s(
        "hiking",
        "activity",
        tag="hiking",
        en=("a hike", "go hiking", "a short trek"),
        ar_LB=("هايكنغ",),
        arabizi=("hiking",),
        fr=("une randonnée",),
    ),
    _s(
        "escape-room",
        "activity",
        tag="escape-room",
        en=("an escape room",),
        ar_LB=("escape room",),
        arabizi=("escape room",),
        fr=("un escape game",),
    ),
    _s(
        "winery",
        "activity",
        tag="winery",
        en=("wine tasting", "a winery"),
        ar_LB=("نبيذ",),
        arabizi=("winery",),
        fr=("une dégustation de vin", "cave a vin"),
    ),
    _s(
        "shopping",
        "activity",
        tag="shopping",
        en=("shopping", "go shopping at the mall"),
        ar_LB=("تسوق", "المول"),
        arabizi=("shopping",),
        fr=("du shopping", "centre commercial"),
    ),
    _s(
        "spa",
        "activity",
        tag="spa",
        en=("a spa", "a massage"),
        ar_LB=("سبا",),
        arabizi=("spa",),
        fr=("un spa",),
    ),
    _s(
        "bar",
        "activity",
        tag="bar",
        en=("drinks at a bar", "a bar"),
        ar_LB=("بار",),
        arabizi=("bar",),
        fr=("un bar",),
    ),
    _s(
        "live-music",
        "activity",
        tag="live-music",
        en=("live music", "a concert"),
        ar_LB=("حفلة",),
        arabizi=("7afle",),
        fr=("un concert",),
    ),
    # ---- Services ----
    _s(
        "exchange",
        "exchange",
        tag="money-changer",
        en=("a money changer", "exchange money", "change dollars"),
        ar_LB=("صراف",),
        arabizi=("sarraf",),
        fr=("un bureau de change",),
    ),
    _s(
        "pharmacy",
        "service",
        tag="pharmacy",
        en=("a pharmacy", "stop at a pharmacy"),
        ar_LB=("صيدلية",),
        arabizi=("saydaliyye",),
        fr=("une pharmacie",),
    ),
    # ---- The night ----
    _s(
        "hotel",
        "stay",
        tag="hotel",
        last=True,
        en=("a hotel", "stay the night at a hotel", "sleep at a hotel"),
        ar_LB=("فندق", "ننام بفندق"),
        arabizi=("hotel",),
        fr=("un hôtel", "dormir à l'hotel"),
    ),
    _s(
        "guesthouse",
        "stay",
        tag="guesthouse",
        last=True,
        en=("a guesthouse", "spend the night at a guest house"),
        ar_LB=("بيت ضيافة",),
        arabizi=("guesthouse",),
        fr=("une maison d'hotes",),
    ),
)

#: "then", as each locale says it. Joined as " {connector} ".
CONNECTORS: dict[str, tuple[str, ...]] = {
    "en": ("then", "and then", "after that", "and after that", "followed by", "next"),
    "ar-LB": ("بعدين", "وبعدين", "بعدها", "وبعدها", "بعد هيك", "ثم"),
    "arabizi": ("ba3den", "w ba3den", "ba3da", "w ba3da", "ba3d hek"),
    "fr": ("puis", "ensuite", "et puis", "après ça", "et ensuite"),
}
#: Words that open a request, with {place} for a destination (or nothing).
OPENERS: dict[str, tuple[str, ...]] = {
    "en": ("", "I want", "Plan a day in {place}:", "In {place},", "We want to go to {place},", "Tomorrow in {place}:"),
    "ar-LB": ("", "بدي", "بدنا", "بدي روح عـ{place}", "بكرا بـ{place}"),
    "arabizi": ("", "badde", "baddna", "badde rou7 3a {place}", "bokra bi {place}"),
    "fr": ("", "Je veux", "Une journée à {place} :", "Demain à {place},", "On veut aller à {place},"),
}
#: The destinations the deterministic reader knows without a database, as each locale writes them.
PLACES: dict[str, dict[str, str]] = {
    "byblos": {"en": "Byblos", "ar-LB": "جبيل", "arabizi": "jbeil", "fr": "Byblos"},
    "batroun": {"en": "Batroun", "ar-LB": "البترون", "arabizi": "batroun", "fr": "Batroun"},
    "bsharri": {"en": "Bsharri", "ar-LB": "بشري", "arabizi": "bsharri", "fr": "Bcharré"},
    "beirut": {"en": "Beirut", "ar-LB": "بيروت", "arabizi": "beirut", "fr": "Beyrouth"},
    "baalbek": {"en": "Baalbek", "ar-LB": "بعلبك", "arabizi": "baalbek", "fr": "Baalbek"},
}
#: A traveller's opening word ("first", "أول شي") and closing word ("finally", "وبالآخر").
FIRST: dict[str, tuple[str, ...]] = {
    "en": ("", "", "first", "start with"),
    "ar-LB": ("", "", "أول شي"),
    "arabizi": ("", "", "awal shi"),
    "fr": ("", "", "d'abord", "commencer par"),
}
LAST: dict[str, tuple[str, ...]] = {
    "en": ("", "finally", "and finally", "to end the day"),
    "ar-LB": ("", "وبالآخر", "بالآخر"),
    "arabizi": ("", "w bel e5er", "bel a5er"),
    "fr": ("", "enfin", "et pour finir"),
}


#: Day-wide asks, as each locale says them, with what they must set.
DRIVER: dict[str, tuple[str, ...]] = {
    "en": ("with a driver,", "I need a driver:", "with a private driver"),
    "ar-LB": ("مع شوفير", "بدي سواق"),
    "arabizi": ("ma3 shofeur", "badde chofer"),
    "fr": ("avec chauffeur,", "avec un chauffeur :"),
}
PICKUP: dict[str, tuple[str, ...]] = {
    "en": ("pick me up from {place},", "pick us up in {place},"),
    "ar-LB": ("مرقلي عـ{place}",),
    "arabizi": ("mer2elle 3a {place}",),
    "fr": ("viens me chercher à {place},",),
}
PARTY: dict[str, tuple[str, ...]] = {
    "en": ("we are {n},", "a family of {n},", "{n} people,"),
    "ar-LB": ("نحنا {n}", "{n} اشخاص"),
    "arabizi": ("ne7na {n}",),
    "fr": ("nous sommes {n},", "on est {n},", "{n} personnes,"),
}
AVOID: dict[str, tuple[str, ...]] = {
    "en": (", no seafood", ", but no fish"),
    "ar-LB": (" بلا سمك",),
    "arabizi": (" bala samak",),
    "fr": (", sans poisson", ", sans fruits de mer"),
}
MAYBE: dict[str, tuple[str, ...]] = {
    "en": ("maybe", "if there is time"),
    "ar-LB": ("إذا في وقت", "يمكن"),
    "arabizi": ("eza fi wa2t", "yemken"),
    "fr": ("peut-être", "si on a le temps"),
}


def _typo(rng: random.Random, phrase: str) -> str:
    """Swap two neighbouring letters inside one long word, as fast typing does."""
    words = phrase.split(" ")
    long = [index for index, word in enumerate(words) if len(word) >= 6 and word.isascii() and word.isalpha()]
    if not long:
        return phrase
    index = rng.choice(long)
    word = words[index]
    at = rng.randrange(1, len(word) - 2)
    words[index] = word[:at] + word[at + 1] + word[at] + word[at + 2 :]
    return " ".join(words)


def _pick(rng: random.Random, options: tuple[str, ...]) -> str:
    return options[rng.randrange(len(options))]


def _steps_for(rng: random.Random) -> list[Step]:
    """2-6 different steps; a night, when there is one, comes last."""
    count = rng.choice((2, 3, 3, 4, 4, 5, 6))
    days = [step for step in STEPS if not step.last]
    chosen = rng.sample(days, k=count)
    # One meal of each kind at most, so "dinner ... seafood dinner" never asks for two dinners.
    seen_meals: set[str] = set()
    kept: list[Step] = []
    for step in chosen:
        if step.meal and step.meal in seen_meals:
            continue
        if step.meal:
            seen_meals.add(step.meal)
        kept.append(step)
    if rng.random() < 0.3:
        kept.append(rng.choice([step for step in STEPS if step.last]))
    return kept if len(kept) >= 2 else [*kept, STEPS[1]]


def _surface(rng: random.Random, step: Step, locale: str) -> str:
    return _pick(rng, step.surfaces[locale])


def _joined(rng: random.Random, phrases: list[str]) -> str:
    """The steps as one request: in a sentence, as a numbered list, with arrows or on separate lines."""
    form = rng.random()
    if form < 0.08:
        return "\n".join(f"{number}. {phrase}" for number, phrase in enumerate(phrases, start=1))
    if form < 0.14:
        return " -> ".join(phrases)
    if form < 0.2:
        return "\n".join(phrases)
    return ""


def _step_phrases(rng: random.Random, steps: list[Step], locale: str, maybe_at: int | None) -> tuple[list[str], str]:
    """Each step's words alone (for lists), and the steps joined into a sentence."""
    bare: list[str] = []
    parts: list[str] = []
    for position, step in enumerate(steps):
        # A mixed prompt switches language step by step, as people do: "terwi2a then the museum".
        step_locale = rng.choice(("en", "arabizi")) if locale == "mixed" else locale
        phrase = _surface(rng, step, step_locale)
        if step_locale == "en" and rng.random() < 0.12:
            phrase = _typo(rng, phrase)
        if position == maybe_at:
            phrase = f"{_pick(rng, MAYBE[step_locale])} {phrase}"
        bare.append(phrase)
        if position == 0:
            parts.append(f"{_pick(rng, FIRST[step_locale])} {phrase}".strip())
            continue
        joiner_locale = rng.choice(("en", "arabizi")) if locale == "mixed" else step_locale
        last = _pick(rng, LAST[joiner_locale]) if position == len(steps) - 1 and position != maybe_at else ""
        parts.append(f"{last or _pick(rng, CONNECTORS[joiner_locale])} {phrase}")
    return bare, " ".join(parts)


def _day_asks(
    rng: random.Random, base: str, place: str | None, steps: list[Step], expected: dict[str, Any]
) -> tuple[list[str], str]:
    """Words for the whole day - a driver, a pickup, how many people, what to avoid - and what they set."""
    lead: list[str] = []
    if rng.random() < 0.15:
        lead.append(_pick(rng, DRIVER[base]))
        expected["transport"] = "driver"
    if place is not None and rng.random() < 0.2:
        lead.append(_pick(rng, PICKUP[base]).replace("{place}", PLACES[place][base]))
        expected["pickup_requested"] = True
    if rng.random() < 0.15:
        size = rng.randint(2, 9)
        lead.append(_pick(rng, PARTY[base]).replace("{n}", str(size)))
        expected["party_size"] = size
    tail = ""
    if rng.random() < 0.1 and not any(step.tag == "seafood" for step in steps):
        tail = _pick(rng, AVOID[base])
        expected["avoid_tags"] = ["seafood"]
    return lead, tail


def _opener(rng: random.Random, base: str, place: str | None) -> tuple[str, str | None]:
    """How the request starts, and the destination it names (None when it names none)."""
    opener = _pick(rng, OPENERS[base])
    if "{place}" not in opener:
        return opener, None
    return ("", None) if place is None else (opener.replace("{place}", PLACES[place][base]), place)


def build_case(index: int, rng: random.Random) -> dict[str, Any]:
    locale = LOCALES[index % len(LOCALES)]
    base = "en" if locale == "mixed" else locale
    steps = _steps_for(rng)
    place = rng.choice([None, *PLACES]) if rng.random() < 0.6 else None
    expected: dict[str, Any] = {}
    # Optional last errand: "maybe bowling". A night is never optional here.
    maybe_at = len(steps) - 1 if not steps[-1].last and rng.random() < 0.1 else None
    bare, sentence = _step_phrases(rng, steps, locale, maybe_at)
    body = _joined(rng, bare) or sentence
    if rng.random() < 0.25:
        body = body.replace(" then ", ", then ").replace(" puis ", ", puis ")
    opener, place = _opener(rng, base, place)
    lead, tail = _day_asks(rng, base, place, steps, expected)

    prompt = " ".join(item for item in (opener, *lead) if item)
    prompt = f"{prompt}\n{body}" if "\n" in body and prompt else f"{prompt} {body}".strip()
    expected["steps"] = [step.expected() for step in steps]
    if maybe_at is not None:
        expected["steps"][maybe_at]["optional"] = True
    if place is not None:
        expected["destinations"] = [place]
    if steps[-1].last:
        expected["ends_overnight"] = True
    return {
        "id": f"gen-{index:04d}-{locale}",
        "locale": "ar-LB" if locale == "arabizi" else base,
        "prompt": "\n".join(" ".join(line.split()) for line in f"{prompt}{tail}".split("\n")),
        "expected": expected,
        "source": "template",
    }


def build(count: int = DEFAULT_COUNT, seed: int = SEED) -> dict[str, Any]:
    rng = random.Random(seed)
    return {
        "version": "generated-v2",
        "threshold": 0.9,
        "note": "Built by app/planner/script/generated_eval.py; labels are right by construction.",
        "cases": [build_case(index, rng) for index in range(count)],
    }


__all__ = ["CONNECTORS", "DEFAULT_COUNT", "FIXTURE_PATH", "LOCALES", "SEED", "STEPS", "build", "build_case"]
