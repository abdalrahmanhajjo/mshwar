"""The field sheet staff take on visits: leads as CSV, safe to open in a spreadsheet.

Lead names come from open data, which anyone can edit. A cell that starts with
``=``, ``+``, ``-``, ``@``, a tab or a carriage return is run as a formula by
Excel and other spreadsheets (CSV injection, CWE-1236), so such cells are
written with a leading apostrophe, which spreadsheets show as plain text.
"""

from __future__ import annotations

import csv
import io
from collections.abc import Iterable
from typing import Any

COLUMNS = (
    "lead_id", "name", "name_ar", "place_type", "destination", "lat", "lng", "map", "source", "source_id",
    "asked_for", "visited_on", "name_on_sign", "site_lat", "site_lng", "open_now", "phone", "hours",
    "halal", "wheelchair_access", "parking", "kids_friendly", "accepts_card", "published_price",
    "price_source_url", "notes",
)  # fmt: skip
_FORMULA_STARTS = ("=", "+", "-", "@", "\t", "\r")
_FILLED = 11  # the columns filled from the lead; the rest are for the visit


def cell(value: Any) -> str:
    """A value as text a spreadsheet will never run."""
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(_FORMULA_STARTS) else text


def field_sheet_csv(leads: Iterable[dict[str, Any]]) -> str:
    """One row per lead, most asked-for first as given, with empty columns to fill in; BOM for Arabic names."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(COLUMNS)
    for lead in leads:
        lat, lng = lead.get("lat"), lead.get("lng")
        filled = [
            lead.get("id"), lead.get("name"), lead.get("name_ar", ""), lead.get("place_type") or "",
            lead.get("destination_slug") or "", lat, lng,
            f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=18/{lat}/{lng}",
            lead.get("source"), lead.get("external_id"), lead.get("demand", 0),
        ]  # fmt: skip
        writer.writerow([cell(value) for value in filled] + [""] * (len(COLUMNS) - _FILLED))
    return "﻿" + buffer.getvalue()


__all__ = ["COLUMNS", "cell", "field_sheet_csv"]
