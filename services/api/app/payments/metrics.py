from __future__ import annotations

from collections import Counter

_counters: Counter[str] = Counter()


def increment(name: str, amount: int = 1) -> None:
    _counters[name] += amount


def snapshot() -> dict[str, int]:
    return dict(_counters)


def reset() -> None:
    _counters.clear()
