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


def leads_from(payload: dict[str, Any], source: str) -> list[dict[str, Any]]:
    """Leads inside Lebanon, from an Overpass export or GeoJSON. Nothing outside the country, nothing unnamed."""
    rows = _osm_leads(payload) if "elements" in payload else _geojson_leads(payload, source)
    return [row for row in rows if in_lebanon(row["lat"], row["lng"])]


__all__ = ["OSM_TAGS", "in_lebanon", "leads_from", "osm_place_type"]
