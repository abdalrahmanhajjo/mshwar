"""Data encryption key helper (security plan SEC-45, docs/KEY_ROTATION.md).

    docker compose -f docker-compose.yml -f docker-compose.staging.yml run --rm \\
        api python scripts/data_key.py current

``current`` prints the key encrypting stored secrets right now (DATA_ENCRYPTION_KEY, or the
one derived from SECRET_KEY). Put it in .env as DATA_ENCRYPTION_KEY before rotating
SECRET_KEY, so saved calendar addresses stay readable. ``new`` prints a fresh random key.
The output is a secret: paste it into .env, never into a ticket or chat.
"""

from __future__ import annotations

import base64
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.secret_box import current_key  # noqa: E402


def main(argv: list[str]) -> int:
    command = argv[1] if len(argv) > 1 else ""
    if command == "current":
        key = current_key()
    elif command == "new":
        key = secrets.token_bytes(32)
    else:
        print("usage: python scripts/data_key.py current|new")
        return 2
    print(base64.urlsafe_b64encode(key).decode())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
