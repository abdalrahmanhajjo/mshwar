#!/usr/bin/env python3

"""Checksum-verified, advisory-locked, forward-only SQL migration runner.

Delegates to mshwar-database/scripts/migrate.py for applying SQL migrations.
"""

import os
import subprocess
import sys
from pathlib import Path

_db_root = Path(__file__).resolve().parents[2] / "mshwar-database"
sys.path.insert(0, str(_db_root))

if __name__ == "__main__":
    subprocess.run(
        [sys.executable, str(_db_root / "scripts" / "migrate.py")],
        check=True,
        env={**os.environ},
    )
