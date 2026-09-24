"""Run the internal scheduler (the partner sweep daily, notification dispatch every minute).

python scripts/scheduler.py          # run forever
python scripts/scheduler.py --check  # exit 0 while the heartbeat is fresh (container health)
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.scheduler import heartbeat_is_fresh, main  # noqa: E402

if __name__ == "__main__":
    if "--check" in sys.argv:
        path = Path(os.environ.get("SCHEDULER_HEARTBEAT", "/tmp/mshwar-scheduler-heartbeat"))  # noqa: S108
        sys.exit(0 if heartbeat_is_fresh(path) else 1)
    asyncio.run(main())
