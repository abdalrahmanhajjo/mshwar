"""Suggestions for what the reader could not read (trip builder v2, layer L4 of section 3.9).

"Somewhere to knock down some pins" has no cue the reader knows, so the clause
is left unparsed - the reader never guesses. This layer ranks the concepts the
words point at ("pins" -> bowling) and offers the best ones to the traveller as
a question with tappable answers. Nothing is added to the day until they choose.

The matcher needs no outside provider: each concept has a list of words that
go with it (what you see, do, eat, hold there), in English, Arabic, Arabizi and
French, plus its own cues. Words are compared after folding, with light
stemming and a typo allowance. ``MeaningMatcher`` is the seam for an embedding
matcher (pgvector) once the reviewed phrase data exists to train and test it.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from app.planner.script.text import token_forms, words
from app.planner.script.vocabulary import ALL_CONCEPTS, FILLER_WORDS

#: Suggestions below this score are not worth a traveller's tap.
MIN_SCORE = 1.0
MAX_SUGGESTIONS = 3

#: Words that go with a concept without naming it. Kept to words with one clear home: "water" or
#: "view" would point everywhere, so they are left out.
ASSOCIATIONS: dict[str, tuple[str, ...]] = {
    "bowling": ("pins", "pin", "lanes", "lane", "strike", "strikes", "spare", "ten pin", "bowl", "balls"),
    "cinema": (
        "blockbuster", "screen", "big screen", "showing", "showtime", "screening", "popcorn", "premiere",
        "trailer", "3d", "imax", "seance", "ecran", "grand ecran", "افلام", "شاشة", "aflam",
    ),
    "cafe": (
        "caffeine", "espresso", "flat white", "latte", "cappuccino", "americano", "brew", "barista", "mocha",
        "nescafe", "turkish coffee", "cafe au lait", "قهوة تركية", "كابتشينو", "ahwe torkiye",
    ),
    "beach": (
        "sand", "sandy", "waves", "wave", "tan", "sunbathe", "sunbathing", "swimsuit", "shore", "coast",
        "feet in the water", "sunbed", "umbrella", "رمل", "موج", "نتشمس", "شمس", "raml", "mowj", "sable",
        "vagues", "bronzer", "maillot",
    ),
    "sunset": ("sun dip", "sky turn", "orange sky", "golden hour", "dusk", "sun goes down", "soleil couchant"),
    "ruins": (
        "romans", "roman", "antiquity", "ancient", "columns", "column", "temples", "phoenician", "phoenicians",
        "archaeology", "excavation", "byzantine", "historic stones", "روماني", "فينيقي", "اعمدة", "antique",
    ),
    "castle": ("crusader", "crusaders", "ramparts", "towers", "walls", "fortress", "moat", "keep", "قلاع", "ابراج", "remparts"),
    "gallery": ("paintings", "painting", "art", "artists", "contemporary art", "sculpture", "exhibit art", "لوحات", "فن", "tableaux"),
    "museum": ("artefacts", "artifacts", "exhibits", "exhibit", "collection", "history", "heritage", "مقتنيات", "تاريخ", "histoire"),
    "church": ("mass", "pray", "prayer", "candle", "saint", "priest", "chapel", "قداس", "صلاة", "شمعة", "messe", "priere"),
    "mosque": ("friday prayer", "jumaa", "minaret", "imam", "صلاة الجمعة", "مئذنة", "salat"),
    "monastery": ("monks", "monk", "hermits", "hermit", "nuns", "saint charbel", "رهبان", "راهب", "moines"),
    "shopping": ("souvenirs", "souvenir", "clothes", "gifts", "brands", "outlet", "shops", "stores", "تياب", "هدايا", "cadeaux", "vetements"),
    "souk": ("haggle", "stalls", "stall", "spices", "soap", "handicrafts", "bargain", "بهارات", "صابون", "epices"),
    "spa": ("pampered", "pamper", "sauna", "jacuzzi", "facial", "relax", "steam room", "wellness", "ساونا", "جاكوزي", "detente"),
    "hiking": ("trail", "trails", "on foot", "walk", "walking", "legs", "hills", "trekking poles", "boots", "مشي", "درب", "sentier", "marche"),
    "forest": ("pines", "pine", "trees", "tree", "woods", "oak", "شجر", "صنوبر", "arbres", "pinede"),
    "cedars": ("ancient trees", "cedar", "arz", "bsharri trees", "cedar trees"),
    "waterfall": ("tumbling", "cascading", "falls", "falling water", "rocks and water", "مي نازلة"),
    "cave": ("stalactites", "stalagmites", "underground", "grotto", "cavern", "caverns", "stalactite"),
    "mountain": ("summit", "high", "altitude", "snow", "peaks", "fresh air", "village", "cool air", "قمة", "هوا", "sommet"),
    "skiing": ("slopes", "slope", "slide down the snow", "snowboard", "ski lift", "chairlift", "pistes"),
    "paragliding": ("parachute", "glide", "gliding", "fly over", "soar", "مظلة", "planer"),
    "diving": ("underwater", "tank", "scuba", "reef", "fins", "mask and fins", "fish under", "تحت المي", "sous l'eau"),
    "kayaking": ("paddle", "paddling", "canoe", "raft", "boat down the river", "rapids", "pagaie"),
    "horse-riding": ("horse", "horses", "saddle", "pony", "stable", "stables", "cheval", "حصان"),
    "zipline": ("cable", "harness", "fly on a cable", "between trees", "tyrolienne"),
    "water-park": ("water slides", "slides", "wave pool", "wave pools", "splash", "toboggan"),
    "amusement-park": ("roller coaster", "roller coasters", "rides", "ferris wheel", "carousel", "manege"),
    "zoo": ("lions", "lion", "giraffes", "giraffe", "animals", "goats", "petting", "farm animals", "حيوانات", "animaux"),
    "arcade": ("video games", "games", "gaming", "console", "joystick", "jeux"),
    "billiards": ("pool", "cue", "snooker", "eight ball", "8 ball", "shoot pool"),
    "karting": ("little cars", "race", "racing", "track", "go kart", "circuit"),
    "escape-room": ("puzzles", "puzzle", "locked room", "clues", "riddles", "enigmes"),
    "winery": ("reds", "red wine", "white wine", "wine", "grapes", "arak", "cellar", "vintage", "عرق", "نبيذ", "vin"),
    "nightclub": ("dance", "dancing", "dj", "dance floor", "party", "rave", "till late", "رقص", "danser"),
    "bar": ("beers", "beer", "cocktails", "cocktail", "pint", "shots", "drinks", "happy hour", "بيرة", "biere"),
    "live-music": ("band", "oud", "singer", "performance", "concert", "gig", "tarab", "طرب", "عود", "musiciens"),
    "seafood": ("prawns", "shrimp", "octopus", "calamari", "catch of the day", "fresh catch", "lobster", "oysters", "قريدس", "اخطبوط", "crevettes"),
    "grill": ("skewers", "charcoal", "kebab", "kofta", "taouk", "meat on the fire", "فحم", "اسياخ", "brochettes"),
    "mezze": ("hummus", "tabbouleh", "fattoush", "small plates", "spread", "kibbeh", "labneh", "moutabal", "حمص", "تبولة"),
    "pizza": ("slices", "cheesy", "pepperoni", "margherita", "slice"),
    "sushi": ("raw fish", "rolls", "maki", "sashimi", "wasabi", "japanese"),
    "shawarma": ("rotating spit", "spit", "wrap", "garlic sauce", "toum", "توم"),
    "falafel": ("chickpea", "chickpeas", "fried balls", "tahini", "حمص مقلي"),
    "ice-cream": ("scoop", "scoops", "cold and creamy", "cone", "pistachio", "sorbet", "بوظة", "boule"),
    "sweets": ("syrup", "baklava", "maamoul", "pastry", "cheese pastry", "ashta", "قطر", "sirop"),
    "manakish": ("zaatar", "za'atar", "flatbread", "kishk", "زعتر", "za3tar"),
    "bakery": ("bread", "oven", "croissants", "loaf", "baked", "خبز", "pain"),
    "burger": ("cheeseburger", "fries", "patty", "burgers"),
    "fine-dining": ("tablecloth", "michelin", "tasting menu", "gourmet", "chef", "fancy", "upscale", "gastronomique"),
    "rooftop": ("up high", "top floor", "on the roof", "skyline", "terrace"),
    "overnight": ("crash", "rest our heads", "sleep", "the night", "bed for the night", "nap"),
    "hotel": ("room service", "reception", "suite", "check in", "room"),
    "guesthouse": ("local family", "family home", "homestay", "host family", "b&b"),
    "hostel": ("dorm", "bunk", "backpacker", "cheap bed", "dortoir"),
    "camping": ("tent", "sleeping bag", "under the stars", "campfire", "bivouac"),
    "chalet": ("cabin", "wooden", "log cabin", "fireplace"),
    "exchange": ("dollars", "lira", "euros", "local money", "currency", "swap money", "rate", "ليرة", "دولار", "devises"),
    "atm": ("cash out", "withdraw", "cash", "card machine", "retirer"),
    "pharmacy": ("medicine", "headache", "pills", "painkillers", "prescription", "دوا", "medicaments"),
    "hospital": ("doctor", "sick", "injury", "emergency", "clinic", "طبيب", "medecin"),
    "sim-card": ("local number", "phone line", "data", "mobile data", "4g", "internet on my phone"),
    "petrol": ("fill up", "tank", "fuel", "gas", "diesel", "بنزين", "essence"),
    "viewpoint": ("view over", "photo spot", "overlook", "panorama", "scenic", "lookout", "vue"),
    "old-town": ("alleys", "old alleys", "stone houses", "narrow streets", "heritage houses", "ruelles"),
    "nature-reserve": ("wildlife", "protected", "birds", "flora", "fauna", "biosphere"),
    "river": ("stream", "creek", "riverbank", "ruisseau"),
    "valley": ("gorge", "canyon", "ravine", "cliffs"),
    "beach-club": ("pool", "lounge", "sunbeds", "cabana", "resort", "poolside"),
}  # fmt: skip

#: Only concepts that make a step are suggested: "tonight" or "pick up" are not something to do.
_STEP_KINDS = frozenset({"meal", "food", "place", "exchange", "stay"})
_STOP = FILLER_WORDS | {"somewhere", "place", "spot", "some", "few", "little", "big", "nice", "good", "local", "and"}


class MeaningMatcher(Protocol):
    def suggest(self, fragment: str) -> list[Suggestion]: ...


@dataclass(frozen=True)
class Suggestion:
    concept: str
    score: float
    #: The words that pointed at it, for the reviewer and for the traveller's "because".
    because: tuple[str, ...]


def _stem(word: str) -> str:
    for ending in ("ing", "es", "s"):
        if len(word) > len(ending) + 3 and word.endswith(ending):
            return word[: -len(ending)]
    return word


@lru_cache(maxsize=1)
def _index() -> tuple[dict[str, list[tuple[str, float]]], dict[tuple[str, ...], list[tuple[str, float]]]]:
    """Single words -> [(concept, weight)], and multi-word terms -> [(concept, weight)]."""
    singles: dict[str, list[tuple[str, float]]] = {}
    phrases: dict[tuple[str, ...], list[tuple[str, float]]] = {}
    sources: list[tuple[str, str, float]] = []
    for concept in ALL_CONCEPTS:
        if concept.kind in _STEP_KINDS:
            sources.extend((cue, concept.slug, 1.5) for cue in concept.cues)
    for slug, terms in ASSOCIATIONS.items():
        sources.extend((term, slug, 1.0) for term in terms)
    for term, slug, weight in sources:
        parts = tuple(_stem(part) for part in words(term) if part not in _STOP)
        if not parts:
            continue
        target = singles.setdefault(parts[0], []) if len(parts) == 1 else phrases.setdefault(parts, [])
        if all(existing != slug for existing, _weight in target):
            target.append((slug, weight))
    return singles, phrases


class AssociationMatcher:
    """Ranks concepts by the associated words a fragment contains. Multi-word terms count more."""

    def suggest(self, fragment: str) -> list[Suggestion]:
        singles, phrases = _index()
        tokens = [token for token in words(fragment) if token not in _STOP]
        forms = [{_stem(form) for form in token_forms(token)} for token in tokens]
        scores: dict[str, float] = {}
        because: dict[str, list[str]] = {}

        def credit(slug: str, weight: float, word: str) -> None:
            scores[slug] = scores.get(slug, 0.0) + weight
            because.setdefault(slug, []).append(word)

        used: set[int] = set()
        for parts, owners in phrases.items():
            for start in range(len(forms) - len(parts) + 1):
                if all(parts[offset] in forms[start + offset] for offset in range(len(parts))):
                    for slug, weight in owners:
                        credit(slug, weight * len(parts), " ".join(tokens[start : start + len(parts)]))
                    used.update(range(start, start + len(parts)))
        for position, token_set in enumerate(forms):
            if position in used:
                continue
            for form in token_set:
                for slug, weight in singles.get(form, ()):
                    credit(slug, weight, tokens[position])
        ranked = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
        return [
            Suggestion(concept=slug, score=round(score, 2), because=tuple(dict.fromkeys(because[slug])))
            for slug, score in ranked[:MAX_SUGGESTIONS]
            if score >= MIN_SCORE
        ]


_matcher: MeaningMatcher = AssociationMatcher()


def suggest(fragment: str) -> list[Suggestion]:
    """Concepts a fragment the reader could not read may mean, best first. Empty when nothing fits."""
    return _matcher.suggest(fragment)


def word_for(concept: str) -> str:
    """A word the reader always understands for a concept: what a tapped suggestion writes into the request."""
    for item in ALL_CONCEPTS:
        if item.slug == concept:
            return item.cues[0]
    raise KeyError(concept)


def use_matcher(matcher: MeaningMatcher | None) -> None:
    """Swap the matcher (an embedding matcher later, or a test double). None restores the default."""
    global _matcher
    _matcher = matcher or AssociationMatcher()


__all__ = ["ASSOCIATIONS", "AssociationMatcher", "MeaningMatcher", "Suggestion", "suggest", "use_matcher", "word_for"]
