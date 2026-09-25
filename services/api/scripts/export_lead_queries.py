"""Write the open-data queries staff run to download place leads (docs/places-import.md).

    python scripts/export_lead_queries.py

Writes app/seed/queries/lebanon.overpassql and lebanon-wikidata.sparql from the importer's own tag
and class maps, so a query can never ask for something the importer does not map. A test checks the
committed files match.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.seed.leads_import import overpass_query, wikidata_query  # noqa: E402

QUERIES = Path(__file__).resolve().parents[1] / "app" / "seed" / "queries"


def main() -> int:
    QUERIES.mkdir(exist_ok=True)
    (QUERIES / "lebanon.overpassql").write_text(overpass_query(), encoding="utf-8")
    (QUERIES / "lebanon-wikidata.sparql").write_text(wikidata_query(), encoding="utf-8")
    print(f"wrote queries to {QUERIES}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
