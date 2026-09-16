"""Process-local sliding-window limiter. Blocks volume enumeration.

Redis is available in compose but unused here so CI and a single API
worker stay consistent. Swap ``MemoryRateLimiter`` for a Redis backend
behind the same ``allow`` contract when the fleet is multi-instance.
"""

from __future__ import annotations

import time
from collections import deque

_SWEEP_EVERY = 1024


class MemoryRateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = {}
        self._windows: dict[str, int] = {}
        self._calls = 0

    def allow(self, key: str, limit: int, window_seconds: int, now: float | None = None) -> bool:
        current = now if now is not None else time.monotonic()
        self._calls += 1
        if self._calls % _SWEEP_EVERY == 0:
            self._sweep(current)
        hits = self._hits.setdefault(key, deque())
        self._windows[key] = window_seconds
        cutoff = current - window_seconds
        while hits and hits[0] <= cutoff:
            hits.popleft()
        if len(hits) >= limit:
            return False
        hits.append(current)
        return True

    def _sweep(self, current: float) -> None:
        """Forget keys with no hits inside their window, so memory stays bounded."""
        stale = [key for key, hits in self._hits.items() if not hits or hits[-1] <= current - self._windows[key]]
        for key in stale:
            del self._hits[key]
            del self._windows[key]

    def reset(self) -> None:
        self._hits.clear()
        self._windows.clear()
        self._calls = 0

    def __len__(self) -> int:
        return len(self._hits)


limiter = MemoryRateLimiter()
