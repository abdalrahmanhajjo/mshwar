"""Write the template-built eval set (app/planner/script/generated_eval.py) to its fixture.

    python scripts/build_generated_eval.py [--count 1200] [--seed 20260925]

A test fails when the fixture and the generator disagree, so run this after changing either.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.planner.script.generated_eval import DEFAULT_COUNT, FIXTURE_PATH, SEED, build  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the generated DayScript eval set")
    parser.add_argument("--count", type=int, default=DEFAULT_COUNT)
    parser.add_argument("--seed", type=int, default=SEED)
    args = parser.parse_args()
    payload = build(args.count, args.seed)
    FIXTURE_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {len(payload['cases'])} cases to {FIXTURE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
