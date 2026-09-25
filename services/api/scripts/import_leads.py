"""Import place leads from open data (see app/seed/leads_import.py).

    python scripts/import_leads.py lebanon-overpass.json --source osm --admin you@mshwar.example
    python scripts/import_leads.py lebanon-wikidata.json --source wikidata --admin you@mshwar.example
    python scripts/import_leads.py ministry-list.geojson --source official_list --admin you@mshwar.example

The OpenStreetMap and Wikidata files come from the queries in app/seed/queries (docs/places-import.md).

DATABASE_URL must point at the database. Leads are for staff to check; nothing reaches travellers.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app.seed.leads_import import leads_from  # noqa: E402

BATCH = 1000


def main() -> int:
    parser = argparse.ArgumentParser(description="Import place leads from open data")
    parser.add_argument("path", type=Path)
    parser.add_argument("--source", required=True, choices=["osm", "wikidata", "official_list", "guide", "staff"])
    parser.add_argument("--admin", required=True, help="email of the platform admin importing the leads")
    args = parser.parse_args()
    url = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if not url:
        parser.error("DATABASE_URL must be set")
    leads = leads_from(json.loads(args.path.read_text(encoding="utf-8")), args.source)
    totals = {"created": 0, "duplicates": 0, "known": 0, "invalid": 0}
    with psycopg.connect(url, autocommit=False) as conn:
        admin = conn.execute("SELECT id FROM app.users WHERE lower(email) = lower(%s)", (args.admin,)).fetchone()
        if admin is None:
            parser.error(f"no user with email {args.admin}")
        for start in range(0, len(leads), BATCH):
            row = conn.execute(
                "SELECT app.admin_import_leads(%s, %s::jsonb)",
                (admin[0], json.dumps(leads[start : start + BATCH], ensure_ascii=False)),
            ).fetchone()
            for key, value in (row[0] if row else {}).items():
                totals[key] = totals.get(key, 0) + int(value)
        conn.commit()
    print(f"{len(leads)} lead(s) read: " + ", ".join(f"{value} {key}" for key, value in totals.items()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
