from __future__ import annotations

from dataclasses import dataclass, field

DESTINATION_ALIASES = {
    "byblos": {"byblos", "jbeil", "جبيل"},
    "batroun": {"batroun", "البترون"},
    "bsharri": {"bsharri", "bcharre", "بشري"},
    "qadisha-valley": {"qadisha", "qadisha valley", "وادي قاديشا", "vallée"},
    "baalbek": {"baalbek", "بعلبك"},
    "beirut": {"beirut", "beyrouth", "بيروت"},
}

CATEGORY_ALIASES = {
    "culture": {"culture", "heritage", "history", "ثقافة"},
    "nature": {"nature", "cedar", "forest", "طبيعة", "أرز"},
    "coast": {"coast", "sea", "beach", "ساحل", "بحر"},
    "adventure": {"adventure", "hike", "hiking", "مغامرة"},
    "city": {"city", "urban", "souk", "مدينة"},
}

KIND_ALIASES = {
    "restaurant": {"restaurant", "lunch", "dinner", "eat", "مطعم", "غداء"},
    "attraction": {"attraction", "museum", "walls", "معلم"},
    "experience": {"experience", "tour", "تجربة"},
}


@dataclass
class ParsedQuery:
    q: str
    destination: str | None = None
    category: str | None = None
    kind: str | None = None
    price_max: int | None = None
    filters: dict[str, str] = field(default_factory=dict)


def parse_search_query(raw: str) -> ParsedQuery:
    """Map a natural-language string onto the same catalogue filters as keyword search."""
    text = (raw or "").strip()
    lowered = text.casefold()
    parsed = ParsedQuery(q=text)
    for slug, aliases in DESTINATION_ALIASES.items():
        if any(alias in lowered for alias in aliases):
            parsed.destination = slug
            parsed.filters["destination"] = slug
            break
    for slug, aliases in CATEGORY_ALIASES.items():
        if any(alias in lowered for alias in aliases):
            parsed.category = slug
            parsed.filters["category"] = slug
            break
    for slug, aliases in KIND_ALIASES.items():
        if any(alias in lowered for alias in aliases):
            parsed.kind = slug
            parsed.filters["kind"] = slug
            break
    if any(token in lowered for token in ("cheap", "budget", "رخيص", "pas cher")):
        parsed.price_max = 30
        parsed.filters["price_max"] = "30"
    return parsed


def relaxation_steps(parsed: ParsedQuery) -> list[dict[str, str]]:
    steps: list[dict[str, str]] = []
    if parsed.q:
        steps.append({"drop": "q", "label": "Search without these words"})
    if parsed.kind:
        steps.append({"drop": "kind", "label": "Any listing kind"})
    if parsed.category:
        steps.append({"drop": "category", "label": "Any category"})
    if parsed.destination:
        steps.append({"drop": "destination", "label": "Anywhere in Lebanon"})
    if parsed.price_max is not None:
        steps.append({"drop": "price_max", "label": "Any price"})
    return steps
