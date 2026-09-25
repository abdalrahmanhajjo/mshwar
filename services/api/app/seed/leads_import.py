"""Turn open data into place leads (migration 049) - never into listings.

Reads an OpenStreetMap Overpass JSON export (``elements``), or GeoJSON
(``features``) from Wikidata or an official list, and yields leads:

    {source, external_id, name, name_ar, name_fr, lat, lng, place_type, raw}

Leads are for staff to check. They are never shown to travellers or planned; a
lead becomes a listing only when staff publish it after a visit or a call
(``app.admin_publish_lead``). OpenStreetMap data is ODbL: the source and id are
kept on every lead, and legal must review share-alike before facts copied from
OpenStreetMap are published (docs/ai-trip-builder-v2-plan.md, 3.11).
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from app.seed.lebanon_catalogue import LEBANON_BBOX

#: OpenStreetMap tags -> Mshwar kinds of place. First match wins; unmapped features become untyped leads.
OSM_TAGS: tuple[tuple[str, str, str], ...] = (
    ("amenity", "cinema", "cinema"),
    ("leisure", "bowling_alley", "bowling"),
    ("leisure", "escape_game", "escape-room"),
    ("leisure", "amusement_arcade", "arcade"),
    ("leisure", "water_park", "water-park"),
    ("leisure", "sports_centre", "padel"),
    ("leisure", "swimming_pool", "public-pool"),
    ("leisure", "beach_resort", "beach-club"),
    ("leisure", "playground", "playground"),
    ("leisure", "park", "park"),
    ("leisure", "nature_reserve", "nature-reserve"),
    ("leisure", "golf_course", "golf"),
    ("sport", "karting", "karting"),
    ("sport", "paragliding", "paragliding"),
    ("sport", "scuba_diving", "diving"),
    ("sport", "climbing", "climbing"),
    ("sport", "skiing", "skiing"),
    ("sport", "equestrian", "horse-riding"),
    ("shop", "pastry", "sweets"),
    ("shop", "confectionery", "sweets"),
    ("shop", "bakery", "bakery"),
    ("shop", "ice_cream", "ice-cream"),
    ("shop", "mall", "mall"),
    ("shop", "books", "bookshop"),
    ("shop", "gift", "souvenirs"),
    ("shop", "wine", "winery"),
    ("amenity", "ice_cream", "ice-cream"),
    ("amenity", "cafe", "cafe"),
    ("amenity", "fast_food", "shawarma"),
    ("amenity", "bar", "bar"),
    ("amenity", "pub", "bar"),
    ("amenity", "nightclub", "nightclub"),
    ("amenity", "theatre", "theatre"),
    ("amenity", "arts_centre", "cultural-centre"),
    ("amenity", "pharmacy", "pharmacy"),
    ("amenity", "hospital", "hospital"),
    ("amenity", "clinic", "clinic"),
    ("amenity", "atm", "atm"),
    ("amenity", "fuel", "petrol"),
    ("amenity", "charging_station", "ev-charger"),
    ("amenity", "car_rental", "car-rental"),
    ("amenity", "toilets", "public-toilets"),
    ("amenity", "place_of_worship", "church"),
    ("amenity", "marketplace", "market"),
    ("amenity", "restaurant", "restaurant"),
    ("tourism", "hotel", "hotel"),
    ("tourism", "guest_house", "guesthouse"),
    ("tourism", "hostel", "hostel"),
    ("tourism", "apartment", "apartment"),
    ("tourism", "chalet", "chalet"),
    ("tourism", "camp_site", "camping"),
    ("tourism", "museum", "museum"),
    ("tourism", "gallery", "gallery"),
    ("tourism", "viewpoint", "viewpoint"),
    ("tourism", "zoo", "zoo"),
    ("tourism", "aquarium", "aquarium"),
    ("tourism", "theme_park", "amusement-park"),
    ("tourism", "picnic_site", "picnic-area"),
    ("tourism", "information", "tourist-info"),
    ("historic", "castle", "castle"),
    ("historic", "fort", "castle"),
    ("historic", "archaeological_site", "ruins"),
    ("historic", "ruins", "ruins"),
    ("historic", "monastery", "monastery"),
    ("historic", "memorial", "memorial"),
    ("natural", "peak", "mountain"),
    ("natural", "cave_entrance", "cave"),
    ("natural", "beach", "beach"),
    ("natural", "spring", "spring"),
    ("natural", "valley", "valley"),
    ("waterway", "waterfall", "waterfall"),
    ("natural", "water", "lake"),
)
#: Restaurants often say more in their cuisine tag than in their amenity tag.
OSM_CUISINE: dict[str, str] = {
    "seafood": "seafood",
    "lebanese": "mezze",
    "grill": "grill",
    "barbecue": "grill",
    "pizza": "pizza",
    "burger": "burger",
    "sushi": "sushi",
    "shawarma": "shawarma",
    "falafel": "falafel",
    "ice_cream": "ice-cream",
}
_RELIGION: dict[str, str] = {"muslim": "mosque", "christian": "church"}


def osm_place_type(tags: dict[str, str]) -> str | None:
    for cuisine in (tags.get("cuisine") or "").split(";"):
        if cuisine.strip() in OSM_CUISINE:
            return OSM_CUISINE[cuisine.strip()]
    if tags.get("amenity") == "place_of_worship":
        return _RELIGION.get(tags.get("religion", ""))
    for key, value, slug in OSM_TAGS:
        if tags.get(key) == value:
            return slug
    return None


def in_lebanon(lat: float, lng: float) -> bool:
    return (
        LEBANON_BBOX["lat_min"] <= lat <= LEBANON_BBOX["lat_max"]
        and LEBANON_BBOX["lng_min"] <= lng <= LEBANON_BBOX["lng_max"]
    )


def _osm_leads(payload: dict[str, Any]) -> Iterator[dict[str, Any]]:
    for element in payload.get("elements") or []:
        tags = element.get("tags") or {}
        lat = element.get("lat", (element.get("center") or {}).get("lat"))
        lng = element.get("lon", (element.get("center") or {}).get("lon"))
        name = tags.get("name:en") or tags.get("name")
        if not name or lat is None or lng is None:
            continue
        yield {
            "source": "osm",
            "external_id": f"{element.get('type', 'node')}/{element.get('id')}",
            "name": name,
            "name_ar": tags.get("name:ar", ""),
            "name_fr": tags.get("name:fr", ""),
            "lat": float(lat),
            "lng": float(lng),
            "place_type": osm_place_type(tags),
            "raw": {"tags": tags},
        }


def _geojson_leads(payload: dict[str, Any], source: str) -> Iterator[dict[str, Any]]:
    for index, feature in enumerate(payload.get("features") or []):
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if geometry.get("type") != "Point" or len(coordinates) < 2:
            continue
        name = properties.get("name_en") or properties.get("name")
        if not name:
            continue
        yield {
            "source": source,
            "external_id": str(properties.get("id") or properties.get("wikidata") or f"feature/{index}"),
            "name": name,
            "name_ar": properties.get("name_ar", ""),
            "name_fr": properties.get("name_fr", ""),
            "lat": float(coordinates[1]),
            "lng": float(coordinates[0]),
            "place_type": properties.get("place_type"),
            "destination_slug": properties.get("destination_slug"),
            "raw": {"properties": properties},
        }


#: Wikidata classes (P31) -> Mshwar kinds of place. Only classes with one clear kind.
WIKIDATA_CLASSES: dict[str, str] = {
    "Q33506": "museum",
    "Q23413": "castle",
    "Q57821": "castle",  # fortification
    "Q839954": "ruins",  # archaeological site
    "Q109607": "ruins",  # ruins
    "Q16970": "church",  # church building
    "Q2977": "church",  # cathedral
    "Q32815": "mosque",
    "Q44613": "monastery",
    "Q34038": "waterfall",
    "Q35509": "cave",
    "Q40080": "beach",
    "Q179049": "nature-reserve",
    "Q8502": "mountain",
    "Q27686": "hotel",
    "Q130003": "skiing",  # ski resort
    "Q156362": "winery",
    "Q43501": "zoo",
    "Q1007870": "gallery",  # art gallery
    "Q132510": "souk",  # market
    "Q22698": "park",
}


def overpass_query() -> str:
    """The Overpass QL that fetches every mapped kind of place in Lebanon, named, with a centre point.

    Run it at https://overpass-turbo.eu (Export -> raw data) or with
    ``curl --data-urlencode data@lebanon.overpassql https://overpass-api.de/api/interpreter``.
    """
    pairs = sorted({(key, value) for key, value, _slug in OSM_TAGS})
    lines = [
        "[out:json][timeout:600];",
        'area["ISO3166-1"="LB"][admin_level=2]->.lebanon;',
        "(",
        *(f'  nwr["{key}"="{value}"]["name"](area.lebanon);' for key, value in pairs),
        '  nwr["amenity"="restaurant"]["cuisine"]["name"](area.lebanon);',
        ");",
        "out center tags;",
    ]
    return "\n".join(lines) + "\n"


def wikidata_query() -> str:
    """The SPARQL for https://query.wikidata.org: places in Lebanon of the mapped classes (or their
    subclasses: a Maronite church is a church), with their English, Arabic and French names."""
    classes = " ".join(f"wd:{qid}" for qid in sorted(WIKIDATA_CLASSES))
    return (
        "SELECT ?item ?class ?coord ?name_en ?name_ar ?name_fr WHERE {\n"
        f"  VALUES ?class {{ {classes} }}\n"
        "  ?item wdt:P17 wd:Q822 ;\n"
        "        wdt:P31/wdt:P279* ?class ;\n"
        "        wdt:P625 ?coord .\n"
        '  OPTIONAL { ?item rdfs:label ?name_en FILTER(LANG(?name_en) = "en") }\n'
        '  OPTIONAL { ?item rdfs:label ?name_ar FILTER(LANG(?name_ar) = "ar") }\n'
        '  OPTIONAL { ?item rdfs:label ?name_fr FILTER(LANG(?name_fr) = "fr") }\n'
        "}\n"
    )


def _point(wkt: str) -> tuple[float, float] | None:
    """``Point(35.64 34.12)`` -> (lat, lng)."""
    inner = wkt.strip().removeprefix("Point(").removesuffix(")").split()
    if len(inner) != 2:
        return None
    try:
        return float(inner[1]), float(inner[0])
    except ValueError:
        return None


def _wikidata_leads(payload: dict[str, Any]) -> Iterator[dict[str, Any]]:
    seen: set[str] = set()
    for binding in (payload.get("results") or {}).get("bindings") or []:
        value = {key: (cell or {}).get("value", "") for key, cell in binding.items()}
        qid = value.get("item", "").rsplit("/", 1)[-1]
        point = _point(value.get("coord", ""))
        name = value.get("name_en") or value.get("name_fr") or value.get("name_ar")
        if not qid.startswith("Q") or qid in seen or point is None or not name:
            continue
        seen.add(qid)
        yield {
            "source": "wikidata",
            "external_id": qid,
            "name": name,
            "name_ar": value.get("name_ar", ""),
            "name_fr": value.get("name_fr", ""),
            "lat": point[0],
            "lng": point[1],
            "place_type": WIKIDATA_CLASSES.get(value.get("class", "").rsplit("/", 1)[-1]),
            "raw": {"wikidata": qid},
        }


def leads_from(payload: dict[str, Any], source: str) -> list[dict[str, Any]]:
    """Leads inside Lebanon, from an Overpass export, a Wikidata SPARQL result or GeoJSON.

    Nothing outside the country, nothing unnamed."""
    if "elements" in payload:
        rows = _osm_leads(payload)
    elif "results" in payload and "head" in payload:
        rows = _wikidata_leads(payload)
    else:
        rows = _geojson_leads(payload, source)
    return [row for row in rows if in_lebanon(row["lat"], row["lng"])]


__all__ = [
    "OSM_TAGS",
    "WIKIDATA_CLASSES",
    "in_lebanon",
    "leads_from",
    "osm_place_type",
    "overpass_query",
    "wikidata_query",
]
