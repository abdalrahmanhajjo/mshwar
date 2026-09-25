"""Write the planner's candidate phrases (app/seed/intent_candidates.py) to a JSON Lines file.

    python scripts/build_phrase_candidates.py [--batch seed-v1] [--out app/seed/data/intent_candidates_v1.jsonl]

Load the file with scripts/import_phrase_candidates.py. Every row is a candidate: the planner reads
none of them until staff approve them at /admin/planner/language.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.seed.intent_candidates import build_candidates, screen, summary  # noqa: E402

DEFAULT_OUT = Path(__file__).resolve().parents[1] / "app" / "seed" / "data" / "intent_candidates_v1.jsonl"


def main() -> int:
    parser = argparse.ArgumentParser(description="Build candidate phrases for review")
    parser.add_argument("--batch", default="seed-v1")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    rows, dropped = screen(build_candidates(args.batch))
    for row in dropped:
        print(f"dropped {row['phrase']!r} ({row['concept']}): {row['why']}")
    args.out.write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")
    print(json.dumps(summary(rows), ensure_ascii=False))
    print(f"wrote {len(rows)} candidates to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
