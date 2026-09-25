"""Seed vocabulary for reading a day the traveller describes in their own words.

This is the first slice of the language dataset in the trip builder v2 plan
(docs/ai-trip-builder-v2-plan.md, section 3.9). Every phrase maps to a
*concept* - a kind of place, a meal, a way of getting around - and never to a
business. The planner later fills each concept from trusted catalogue rows, so
nothing in this file can make a place trusted.

Phrases are written as travellers write them: English, Lebanese Arabic, MSA,
Arabizi and French, with common misspellings. They are folded with the same
``fold()`` as catalogue names before matching, so accents, alef forms and
punctuation do not matter. Arabizi spellings also get generated variants
(``7`` -> ``h``, ``2`` dropped, ...), see ``arabizi_variants``.

When this moves into ``app.intent_phrases`` (migration 046) the concept slugs
stay the same; only where the phrases live changes.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Literal

ConceptKind = Literal[
    "meal",  # a meal of the day: sets StepSpec.meal
    "food",  # a kind of food or eatery: a tag on the meal step
    "place",  # a place to go: its own step, unless it only describes a meal
    "exchange",  # a money changer
    "stay",  # where the night is spent: always the last step
    "transport",  # how the traveller gets around: day-wide, not a step
    "pickup",  # "pick me up": day-wide
    "return",  # "bring me back": day-wide
    "time",  # a time of day: annotates the steps of its clause
]


@dataclass(frozen=True)
class Concept:
    slug: str
    kind: ConceptKind
    cues: tuple[str, ...]
    role: str | None = None
    tag: str | None = None
    meal: str | None = None
    #: The tag this concept adds when it describes a meal ("dinner by the sea").
    modifier_tag: str | None = None
    extra_tags: tuple[str, ...] = field(default_factory=tuple)


def _place(
    slug: str, role: str, cues: tuple[str, ...], modifier: str | None = None, extra: tuple[str, ...] = ()
) -> Concept:
    return Concept(slug=slug, kind="place", cues=cues, role=role, tag=slug, modifier_tag=modifier, extra_tags=extra)


def _food(slug: str, cues: tuple[str, ...]) -> Concept:
    return Concept(slug=slug, kind="food", cues=cues, role="meal", tag=slug)


def _meal(slug: str, cues: tuple[str, ...]) -> Concept:
    return Concept(slug=f"meal-{slug}", kind="meal", cues=cues, role="meal", meal=slug)


def _stay(slug: str, cues: tuple[str, ...]) -> Concept:
    return Concept(slug=slug, kind="stay", cues=cues, role="stay", tag=slug)


def _time(slug: str, cues: tuple[str, ...]) -> Concept:
    return Concept(slug=f"time-{slug}", kind="time", cues=cues)


MEAL_CONCEPTS: tuple[Concept, ...] = (
    _meal(
        "breakfast",
        (
            "breakfast",
            "brekkie",
            "brekfast",
            "breakfest",
            "ترويقة",
            "ترويقه",
            "نترويق",
            "فطور",
            "terwi2a",
            "trewi2a",
            "tarwi2a",
            "terwi'a",
            "ftour",
            "fotour",
            "petit dejeuner",
            "petit dej",
        ),
    ),
    _meal("brunch", ("brunch",)),
    _meal(
        "lunch", ("lunch", "lunchtime", "غدا", "غداء", "الغدا", "نتغدى", "ghada", "gheda", "8ada", "dejeuner", "dej")
    ),
    _meal(
        "dinner",
        ("dinner", "supper", "diner", "عشا", "عشاء", "العشا", "نتعشى", "3asha", "3ashe", "asha", "souper", "dîner"),
    ),
    _meal("snack", ("snack", "a bite", "something to eat", "gouter", "سناك")),
)

FOOD_CONCEPTS: tuple[Concept, ...] = (
    Concept(
        slug="eat",
        kind="food",
        role="meal",
        cues=(
            "eat",
            "eating",
            "food",
            "restaurant",
            "restaurants",
            "resto",
            "مطعم",
            "مطاعم",
            "ناكل",
            "akel",
            "akl",
            "manger",
            "bouffer",
            "nekol",
            "nokol",
            "nekel",
        ),
    ),
    _food(
        "sweets",
        (
            "sweet",
            "sweets",
            "sweet shop",
            "sweat",
            "sweat place",
            "dessert",
            "desserts",
            "knefeh",
            "knefe",
            "kanafeh",
            "knafeh",
            "kunafa",
            "patisserie",
            "pastry",
            "pastries",
            "حلويات",
            "حلو",
            "كنافة",
            "كنافه",
            "7elweyet",
            "7lweyet",
            "7elwayet",
            "hilweyet",
        ),
    ),
    _food("bakery", ("bakery", "bakeries", "boulangerie", "croissant", "فرن", "forn")),
    _food(
        "manakish",
        ("manakish", "manakeesh", "manousheh", "man2oushe", "man2oucheh", "mana2ish", "منقوشة", "منقوشه", "مناقيش"),
    ),
    _food("cafe", ("coffee", "cafe", "coffee shop", "قهوة", "قهوه", "كافيه", "2ahwe", "ahwe")),
    _food("seafood", ("seafood", "fish", "سمك", "samak", "poisson", "fruits de mer")),
    _food("grill", ("grill", "bbq", "barbecue", "mashawi", "meshwe", "مشاوي", "مشاوى")),
    _food(
        "mezze",
        ("mezze", "meze", "lebanese food", "traditional food", "مازة", "مازه", "akl lebnene", "cuisine libanaise"),
    ),
    _food("pizza", ("pizza", "بيتزا")),
    _food("burger", ("burger", "burgers", "برغر", "همبرغر")),
    _food("sushi", ("sushi", "سوشي")),
    _food("shawarma", ("shawarma", "shawerma", "chawarma", "شاورما")),
    _food("falafel", ("falafel", "فلافل")),
    _food("ice-cream", ("ice cream", "icecream", "gelato", "bouza", "بوظة", "بوظه", "glace")),
    _food("fine-dining", ("fine dining", "fancy restaurant", "gastronomique")),
    _food("rooftop", ("rooftop", "roof top", "روف")),
)

PLACE_CONCEPTS: tuple[Concept, ...] = (
    # Nature and views
    _place(
        "mountain",
        "sight",
        (
            "mountain",
            "mountains",
            "mountin",
            "mount",
            "peak",
            "summit",
            "جبل",
            "جبال",
            "الجبل",
            "jabal",
            "jbal",
            "jabel",
            "montagne",
            "montagnes",
            "sommet",
        ),
        modifier="mountain-view",
    ),
    _place(
        "viewpoint",
        "sight",
        ("view", "viewpoint", "panorama", "lookout", "scenic view", "منظر", "بانوراما", "belvedere", "point de vue"),
        modifier="view",
    ),
    _place(
        "sunset",
        "sight",
        ("sunset", "sun set", "غروب", "الغروب", "ghroub", "coucher de soleil"),
        modifier="sunset",
        extra=("viewpoint",),
    ),
    _place("cedars", "sight", ("cedar", "cedars", "أرز", "ارز", "الارز", "arz", "cedres")),
    _place("forest", "sight", ("forest", "woods", "pine forest", "غابة", "غابه", "ghabe", "foret")),
    _place("waterfall", "sight", ("waterfall", "waterfalls", "شلال", "شلالات", "shallal", "cascade")),
    _place("cave", "sight", ("cave", "caves", "grotto", "مغارة", "مغاره", "m8ara", "maghara", "grotte")),
    _place(
        "beach",
        "sight",
        ("beach", "sea", "swim", "swimming", "بحر", "البحر", "شط", "bahr", "ba7r", "plage", "mer"),
        modifier="sea-view",
    ),
    _place("river", "sight", ("river", "نهر", "nahr", "riviere")),
    _place("valley", "sight", ("valley", "gorge", "وادي", "wadi", "vallee")),
    _place("nature-reserve", "sight", ("nature reserve", "محمية", "reserve naturelle")),
    _place(
        "hiking", "activity", ("hike", "hiking", "trek", "trekking", "trail", "هايكنغ", "مشي بالطبيعة", "randonnee")
    ),
    # Heritage and culture
    _place(
        "ruins",
        "sight",
        ("ruins", "ancient", "roman", "temple", "archaeological", "آثار", "اثار", "athar", "ruines"),
    ),
    _place("castle", "sight", ("castle", "citadel", "fort", "قلعة", "قلعه", "2al3a", "chateau")),
    _place("old-town", "sight", ("old town", "old city", "البلد القديمة", "vieille ville")),
    _place("souk", "sight", ("souk", "souks", "souq", "سوق", "اسواق", "souk el")),
    _place("museum", "sight", ("museum", "museums", "متحف", "mat7af", "musee")),
    _place("church", "sight", ("church", "كنيسة", "كنيسه", "kanise", "eglise")),
    _place("mosque", "sight", ("mosque", "جامع", "مسجد", "jemee3", "mosquee")),
    _place("monastery", "sight", ("monastery", "convent", "دير", "deir", "monastere")),
    _place("gallery", "sight", ("gallery", "art gallery", "معرض", "galerie")),
    # Entertainment
    _place(
        "cinema",
        "activity",
        (
            "cinema",
            "movie",
            "movies",
            "film",
            "films",
            "the pictures",
            "سينما",
            "السينما",
            "فيلم",
            "sinama",
            "cinéma",
            "cine",
        ),
    ),
    _place("bowling", "activity", ("bowling", "bowling alley", "بولينغ", "بولينج", "bowlinj")),
    _place("escape-room", "activity", ("escape room", "escape game")),
    _place("karting", "activity", ("karting", "go kart", "go karting", "kart", "كارتينغ")),
    _place("arcade", "activity", ("arcade", "video games", "gaming", "playstation")),
    _place("billiards", "activity", ("billiards", "pool table", "snooker", "بلياردو")),
    _place("water-park", "activity", ("water park", "waterpark", "aquapark", "aqua park", "parc aquatique")),
    _place("amusement-park", "activity", ("amusement park", "theme park", "luna park", "funfair", "ملاهي", "malahi")),
    _place("zoo", "activity", ("zoo", "حديقة حيوانات", "animal park")),
    _place("bar", "activity", ("bar", "bars", "pub", "drinks", "cocktail", "cocktails", "بار")),
    _place(
        "winery",
        "activity",
        (
            "winery",
            "wine tasting",
            "vineyard",
            "cave a vin",
            "degustation de vin",
            "degustation",
            "vignoble",
            "domaine viticole",
            "نبيذ",
            "كرم عنب",
        ),
    ),
    _place("nightclub", "activity", ("nightclub", "club", "clubbing", "dance", "نايت كلوب", "boite de nuit")),
    _place("live-music", "activity", ("live music", "concert", "gig", "حفلة", "7afle", "musique live")),
    # Sport and adventure
    _place("skiing", "activity", ("ski", "skiing", "snowboard", "تزلج", "تزحلق", "tazala2")),
    _place("paragliding", "activity", ("paragliding", "parapente", "طيران شراعي")),
    _place("diving", "activity", ("diving", "scuba", "snorkel", "snorkelling", "غطس", "plongee")),
    _place("kayaking", "activity", ("kayak", "kayaking", "rafting", "canoe")),
    _place("horse-riding", "activity", ("horse riding", "horseback", "horses", "ركوب خيل", "خيل", "equitation")),
    _place("zipline", "activity", ("zipline", "zip line", "tyrolienne")),
    _place("beach-club", "activity", ("beach club", "pool", "swimming pool", "مسبح", "piscine")),
    # Wellness and shopping
    _place("spa", "activity", ("spa", "massage", "hammam", "حمام", "سبا")),
    _place(
        "shopping",
        "activity",
        ("shopping", "shop", "shops", "mall", "boutiques", "تسوق", "مول", "centre commercial", "magasins"),
    ),
    # Essentials
    _place("pharmacy", "service", ("pharmacy", "chemist", "صيدلية", "صيدليه", "saydaliyye", "pharmacie")),
    _place("atm", "service", ("atm", "cash machine", "صراف آلي", "صراف الي", "distributeur")),
    _place("sim-card", "service", ("sim", "sim card", "phone line", "شريحة", "خط تلفون", "carte sim")),
    _place("petrol", "service", ("petrol", "gas station", "fuel", "بنزين", "محطة بنزين", "essence")),
    _place("hospital", "service", ("hospital", "doctor", "clinic", "مستشفى", "حكيم", "hopital")),
)

EXCHANGE_CONCEPT = Concept(
    slug="exchange",
    kind="exchange",
    role="exchange",
    tag="money-changer",
    cues=(
        "money changer",
        "currency changer",
        "money exchange",
        "currency exchange",
        "exchange money",
        "change money",
        "change dollars",
        "exchange office",
        "changer",
        "currency",
        "exchange",
        "sarraf",
        "sarref",
        "صراف",
        "صيرفة",
        "صيرفه",
        "صرافة",
        "صرافه",
        "تصريف",
        "صرّف",
        "bureau de change",
        "changer de l'argent",
        "bureau change",
    ),
)

STAY_CONCEPTS: tuple[Concept, ...] = (
    # A night away without saying where: a stay step with no narrower tag.
    Concept(
        slug="overnight",
        kind="stay",
        role="stay",
        cues=(
            "stay the night",
            "stay night",
            "spend the night",
            "sleep",
            "overnight",
            "ننام",
            "نام",
            "منام",
            "nnam",
            "nam",
            "dormir",
            "passer la nuit",
        ),
    ),
    _stay("hotel", ("hotel", "hotels", "hotle", "otel", "boutique hotel", "فندق", "اوتيل", "hôtel")),
    _stay("guesthouse", ("guesthouse", "guest house", "b&b", "bed and breakfast", "maison d'hotes", "بيت ضيافة")),
    _stay("hostel", ("hostel", "auberge de jeunesse")),
    _stay("chalet", ("chalet", "شاليه")),
    _stay("camping", ("camping", "campsite", "tent", "خيمة", "تخييم")),
)

TRANSPORT_CONCEPTS: tuple[Concept, ...] = (
    Concept(
        slug="driver",
        kind="transport",
        tag="driver",
        cues=(
            "driver",
            "a driver",
            "private driver",
            "car with driver",
            "taxi for the day",
            "chauffeur",
            "شوفير",
            "سائق",
            "سواق",
            "shofeur",
            "chofer",
        ),
    ),
    Concept(
        slug="public",
        kind="transport",
        tag="public",
        cues=("bus", "van", "public transport", "فان", "باص", "بوسطة", "transport en commun"),
    ),
    Concept(
        slug="own",
        kind="transport",
        tag="own",
        cues=("my car", "our car", "i will drive", "i'll drive", "we drive", "سيارتي", "ma voiture"),
    ),
)

PICKUP_CONCEPT = Concept(
    slug="pickup",
    kind="pickup",
    cues=(
        "pick me up",
        "pick us up",
        "pickup",
        "pick up",
        "pass me",
        "pass by me",
        "collect me",
        "come get me",
        "get me from",
        "مرقلي",
        "مر علي",
        "مرق علي",
        "تمرقلي",
        "mer2elle",
        "mar2elle",
        "viens me chercher",
        "passe me prendre",
    ),
)

RETURN_CONCEPT = Concept(
    slug="return",
    kind="return",
    cues=(
        "back to",
        "bring me back",
        "bring us back",
        "drive me back",
        "take me back",
        "take us back",
        "return to",
        "back home",
        "back by",
        "رجعني",
        "رجعنا",
        "rajje3ne",
        "raje3ne",
        "retour a",
        "ramene moi",
        "ramene nous",
    ),
)

TIME_CONCEPTS: tuple[Concept, ...] = (
    _time("morning", ("morning", "early", "الصبح", "الصباح", "بكير", "sob7", "sobo7", "bakkir", "matin")),
    _time("midday", ("noon", "midday", "الضهر", "الظهر", "dohr", "midi")),
    _time(
        "afternoon",
        ("afternoon", "بعد الضهر", "بعد الظهر", "ba3d el dohr", "ba3ed el dohr", "apres midi", "après-midi"),
    ),
    _time("evening", ("evening", "المسا", "المساء", "masa", "soir", "soiree")),
    _time("night", ("night", "tonight", "late night", "بالليل", "الليل", "lel", "bel lel", "nuit", "ce soir")),
)

ALL_CONCEPTS: tuple[Concept, ...] = (
    *MEAL_CONCEPTS,
    *FOOD_CONCEPTS,
    *PLACE_CONCEPTS,
    EXCHANGE_CONCEPT,
    *STAY_CONCEPTS,
    *TRANSPORT_CONCEPTS,
    PICKUP_CONCEPT,
    RETURN_CONCEPT,
    *TIME_CONCEPTS,
)

#: Every tag a step may carry. The schema drops anything else.
STEP_TAGS: frozenset[str] = frozenset(
    {concept.tag for concept in ALL_CONCEPTS if concept.tag and concept.kind in {"food", "place", "exchange", "stay"}}
    | {concept.modifier_tag for concept in ALL_CONCEPTS if concept.modifier_tag}
    | {tag for concept in ALL_CONCEPTS for tag in concept.extra_tags}
)

# ---- Words that shape a sentence rather than name a place ----

#: Split a request into steps. Longest first, so "and then" wins over "then".
SEQUENCE_CONNECTORS: tuple[str, ...] = (
    "and after that",
    "and after it",
    "and then",
    "after that",
    "after it",
    "after this",
    "afterwards",
    "and finally",
    "and lastly",
    "at the end",
    "in the end",
    "to finish",
    "to start",
    "start with",
    "starting with",
    "first of all",
    "followed by",
    "and next",
    "next",
    "to end the day",
    "to end",
    "end with",
    "ending with",
    "finally",
    "lastly",
    "then",
    "later",
    "first",
    "وبعد هيك",
    "بعد هيك",
    "وبعدين",
    "بعدين",
    "وبعدها",
    "بعدها",
    "ومن بعدها",
    "ثم",
    "وبالآخر",
    "بالآخر",
    "بالاخر",
    "وبالاخير",
    "بالاخير",
    "واخر شي",
    "اخر شي",
    "آخر شي",
    "اول شي",
    "أول شي",
    "w ba3den",
    "ba3den",
    "ba3dein",
    "w ba3da",
    "ba3da",
    "w ba3d hek",
    "ba3d hek",
    "w bel a5er",
    "w bel e5er",
    "bel a5er",
    "bel e5er",
    "awal shi",
    "awwal shi",
    "et ensuite",
    "ensuite",
    "et puis",
    "puis",
    "apres ca",
    "après ça",
    "et enfin",
    "enfin",
    "finalement",
    "et pour finir",
    "pour finir",
    "pour terminer",
    "d'abord",
    "pour commencer",
    "commencer par",
)

#: Connectors that are not "then" in some company: "next to the beach", "next week".
CONNECTOR_GUARDS: dict[str, str] = {"next": r"(?!\s+(?:to|door|day|week|weekend|month|year|time)\b)"}

#: Little words that may sit between a joiner and the place it joins ("and *a* movie").
ARTICLES: frozenset[str] = frozenset({"a", "an", "the", "some", "le", "la", "les", "l", "un", "une", "des", "du", "el"})

#: Two steps joined by one of these may happen in either order.
FLEXIBLE_JOINERS: frozenset[str] = frozenset({"and", "also", "plus", "w", "et", "aussi", "or"})

BEFORE_WORDS: frozenset[str] = frozenset({"before", "قبل", "abel", "2abel", "avant"})
AFTER_WORDS: frozenset[str] = frozenset({"after", "بعد", "ba3d", "ba3ed", "apres"})
#: "before all of that" puts a step at the very start of the day.
EVERYTHING_WORDS: frozenset[str] = frozenset({"all", "everything", "anything", "كل", "kil", "kell", "tout"})

NEGATIONS: frozenset[str] = frozenset(
    {
        "no",
        "not",
        "without",
        "dont",
        "don't",
        "never",
        "skip",
        "بلا",
        "بدون",
        "مش",
        "ما",
        "bala",
        "bidoun",
        "mish",
        "msh",
        "pas",
        "sans",
    }
)

OPTIONAL_CUES: tuple[str, ...] = (
    "maybe",
    "if there is time",
    "if there's time",
    "if we have time",
    "if time allows",
    "optional",
    "يمكن",
    "اذا في وقت",
    "إذا في وقت",
    "iza fi wa2et",
    "iza fi wa2t",
    "eza fi wa2t",
    "eza fi wa2et",
    "eza l7a2na",
    "iza l7a2na",
    "اذا لحقنا",
    "إذا لحقنا",
    "if possible",
    "yemken",
    "si possible",
    "peut etre",
    "peut-être",
    "si on a le temps",
)

AIRPORT_CUES: tuple[str, ...] = ("airport", "the airport", "we land", "landing", "مطار", "المطار", "matar", "aeroport")

DIETARY_CUES: dict[str, tuple[str, ...]] = {
    "halal": ("halal", "حلال"),
    "vegetarian": ("vegetarian", "veggie", "نباتي", "vegetarien"),
    "vegan": ("vegan", "végan", "فيغن"),
    "gluten-free": ("gluten free", "gluten-free", "sans gluten", "celiac"),
}

ACCESSIBILITY_CUES: dict[str, tuple[str, ...]] = {
    "wheelchair": ("wheelchair", "wheel chair", "كرسي متحرك", "fauteuil roulant"),
    "step-free": ("no stairs", "step free", "step-free", "can't climb", "بلا درج"),
}

#: Ordinary words one letter away from a cue. Typo matching must never turn them into a place
#: ("no driving" is not diving, a "boutique hotel" is not shopping).
FUZZY_BLOCKLIST: frozenset[str] = frozenset(
    {"driving", "drive", "living", "giving", "moving", "having", "saving", "boutique"}
)

#: Words that carry no content on their own: a clause made only of these is not "unparsed".
FILLER_WORDS: frozenset[str] = frozenset(
    {
        "i",
        "we",
        "me",
        "us",
        "my",
        "our",
        "want",
        "wanna",
        "would",
        "like",
        "to",
        "go",
        "get",
        "a",
        "an",
        "the",
        "at",
        "in",
        "on",
        "for",
        "of",
        "with",
        "some",
        "trip",
        "day",
        "do",
        "see",
        "visit",
        "play",
        "watch",
        "have",
        "take",
        "place",
        "please",
        "and",
        "then",
        "it",
        "that",
        "this",
        "there",
        "بدي",
        "بدنا",
        "روح",
        "نروح",
        "ع",
        "على",
        "في",
        "من",
        "badde",
        "bade",
        "baddna",
        "nrouh",
        "je",
        "veux",
        "veut",
        "aller",
        "un",
        "une",
        "le",
        "la",
        "les",
        "de",
        "du",
        "des",
    }
)

# ---- Generated Arabizi variants ----

_ARABIZI_SUBSTITUTIONS: dict[str, tuple[str, ...]] = {
    "2": ("", "a", "'"),
    "3": ("", "a", "'"),
    "5": ("kh",),
    "7": ("h",),
    "8": ("gh",),
    "9": ("q",),
}


def arabizi_variants(cue: str) -> set[str]:
    """Other ways the same Arabizi word is typed: ``terwi2a`` -> ``terwia``, ``terwi'a``.

    Only cues that contain an Arabizi digit get variants; English and French
    words are left alone. The expansion is bounded (at most two digits vary).
    """
    variants = {cue}
    digits = [index for index, char in enumerate(cue) if char in _ARABIZI_SUBSTITUTIONS]
    if not digits or not any(char.isalpha() and char.isascii() for char in cue):
        return variants
    for index in digits[:2]:
        grown: set[str] = set()
        for variant in variants:
            char = cue[index]
            offset = len(variant) - len(cue)
            position = index + offset
            if position < 0 or position >= len(variant) or variant[position] != char:
                continue
            for substitute in _ARABIZI_SUBSTITUTIONS[char]:
                grown.add(variant[:position] + substitute + variant[position + 1 :])
        variants |= grown
    return {variant for variant in variants if len(variant.replace("'", "")) >= 3}


def cue_phrases(concept: Concept) -> Iterable[str]:
    """Every phrase that names a concept, generated variants included."""
    for cue in concept.cues:
        yield from arabizi_variants(cue)


__all__ = [
    "ACCESSIBILITY_CUES",
    "AFTER_WORDS",
    "AIRPORT_CUES",
    "ARTICLES",
    "ALL_CONCEPTS",
    "BEFORE_WORDS",
    "CONNECTOR_GUARDS",
    "DIETARY_CUES",
    "EVERYTHING_WORDS",
    "FILLER_WORDS",
    "FLEXIBLE_JOINERS",
    "FUZZY_BLOCKLIST",
    "NEGATIONS",
    "OPTIONAL_CUES",
    "SEQUENCE_CONNECTORS",
    "STEP_TAGS",
    "Concept",
    "arabizi_variants",
    "cue_phrases",
]
