"""Send one test SMS through the configured provider, to check the Twilio settings.

    docker compose -f docker-compose.yml -f docker-compose.staging.yml run --rm \\
        api python scripts/send_test_sms.py +9613123456

Prints what happened and exits non-zero if the provider refused. It uses the same
settings the API boots with, so a pass here means partners will receive their codes.
"""

from __future__ import annotations

import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings  # noqa: E402
from app.core.sms import SmsError, get_sms  # noqa: E402

E164 = re.compile(r"^\+[1-9]\d{7,14}$")


async def send(to: str) -> int:
    if not E164.fullmatch(to):
        print("Give the number in international form, for example +9613123456.")
        return 2
    if settings.sms_backend != "twilio":
        print(f"SMS_BACKEND is {settings.sms_backend!r}: nothing is sent. Set SMS_BACKEND=twilio first.")
        return 1
    try:
        await get_sms().send(to, "Mshwar test message: your SMS settings work.")
    except SmsError as exc:
        print(f"Not sent: {exc}")
        return 1
    print(f"Sent to ...{to[-3:]} through Twilio. Check the phone.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(asyncio.run(send(sys.argv[1])))
