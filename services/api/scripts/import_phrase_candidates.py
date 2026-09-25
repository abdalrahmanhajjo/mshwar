"""Load candidate phrases (JSON Lines from build_phrase_candidates.py) for staff review.

    python scripts/import_phrase_candidates.py app/seed/data/intent_candidates_v1.jsonl --admin you@mshwar.example

DATABASE_URL must point at the database. Rows go in as candidates through
app.admin_import_phrase_candidates: known phrases are skipped, a rejected phrase is never imported
again, and nothing is read by the planner until it is approved.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app.planner.script.learning import CONCEPT_SLUGS  # noqa: E402

CHUNK = 5000


def main() -> int:
    parser = argparse.ArgumentParser(description="Import candidate phrases for review")
    parser.add_argument("path", type=Path)
    parser.add_argument("--admin", required=True, help="email of the platform admin importing them")
    args = parser.parse_args()
    url = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if not url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 2
    rows = [json.loads(line) for line in args.path.read_text(encoding="utf-8").splitlines() if line.strip()]
    unknown = sorted({row["concept"] for row in rows} - CONCEPT_SLUGS)
    if unknown:
        print(f"unknown concepts: {', '.join(unknown)}", file=sys.stderr)
        return 2
    totals = {"created": 0, "known": 0, "invalid": 0}
    with psycopg.connect(url) as conn:
        admin = conn.execute("SELECT id FROM app.users WHERE lower(email) = lower(%s)", (args.admin,)).fetchone()
        if admin is None:
            print(f"no user {args.admin}", file=sys.stderr)
            return 2
        for start in range(0, len(rows), CHUNK):
            chunk = json.dumps(rows[start : start + CHUNK], ensure_ascii=False)
            result = conn.execute("SELECT app.admin_import_phrase_candidates(%s, %s::jsonb)", (admin[0], chunk))
            counts = result.fetchone()[0]
            for key in totals:
                totals[key] += int(counts.get(key, 0))
            conn.commit()
    print(json.dumps(totals))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
