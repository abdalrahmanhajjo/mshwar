"""Record prices staff checked at the official source, from a CSV (see app/seed/sourced_prices.py).

    python scripts/import_sourced_prices.py prices.csv --admin you@mshwar.example [--dry-run]

DATABASE_URL must point at the database. The admin must be a platform admin; every row is
checked by app.admin_set_sourced_price exactly like the admin screen.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import psycopg  # noqa: E402

from app.seed.sourced_prices import read_rows, record  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Record published prices with their sources")
    parser.add_argument("csv_path", type=Path)
    parser.add_argument("--admin", required=True, help="email of the platform admin recording the prices")
    parser.add_argument("--dry-run", action="store_true", help="check every row, record nothing")
    args = parser.parse_args()
    url = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
    if not url:
        parser.error("DATABASE_URL must be set")
    rows, errors = read_rows(args.csv_path.read_text(encoding="utf-8"))
    recorded = 0
    if rows:
        with psycopg.connect(url, autocommit=False) as conn:
            recorded, failed = record(conn, args.admin, rows, dry_run=args.dry_run)
            errors.extend(failed)
    verb = "would record" if args.dry_run else "recorded"
    print(f"{verb} {recorded} price(s); {len(errors)} row(s) skipped")
    for error in sorted(errors, key=lambda item: item.line):
        print(f"  line {error.line} {error.slug or '-'}: {error.reason}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
