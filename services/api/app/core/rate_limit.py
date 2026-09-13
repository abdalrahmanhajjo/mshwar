"""Process-local sliding-window limiter. Blocks volume enumeration.

Redis is available in compose but unused here so CI and a single API
worker stay consistent. Swap ``MemoryRateLimiter`` for a Redis backend
behind the same ``allow`` contract when the fleet is multi-instance.
"""

from __future__ import annotations

import time
from collections import defaultdict


class MemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str, limit: int, window_seconds: int, now: float | None = None) -> bool:
        current = now if now is not None else time.monotonic()
        cutoff = current - window_seconds
        recent = [stamp for stamp in self._hits[key] if stamp > cutoff]
        if len(recent) >= limit:
            self._hits[key] = recent
            return False
        recent.append(current)
        self._hits[key] = recent
        return True

    def reset(self) -> None:
        self._hits.clear()


limiter = MemoryRateLimiter()
