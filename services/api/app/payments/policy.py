from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any


def _as_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value
    text = str(value).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed


def refund_bps_from_snapshot(snapshot: Mapping[str, Any], starts_at: Any, *, now: datetime | None = None) -> int:
    """Eligibility is computed only from the frozen policy snapshot."""

    clock = now or datetime.now(UTC)
    start = _as_datetime(starts_at)
    rules = snapshot.get("rules") if isinstance(snapshot.get("rules"), dict) else snapshot
    windows = snapshot.get("windows")
    if windows is None and isinstance(rules, dict):
        windows = rules.get("windows")
    best = 0
    if isinstance(windows, list):
        for window in windows:
            if not isinstance(window, dict):
                continue
            hours = float(window.get("hours_before") or 0)
            bps = int(window.get("refund_bps") or 0)
            if start.timestamp() - hours * 3600 >= clock.timestamp():
                best = max(best, bps)
        return best
    hours_raw = 0.0
    if isinstance(rules, dict) and rules.get("hours") is not None:
        hours_raw = float(rules["hours"])
    elif snapshot.get("hours") is not None:
        hours_raw = float(snapshot["hours"])
    if hours_raw > 0 and start.timestamp() - hours_raw * 3600 >= clock.timestamp():
        return 10000
    return 0


def refund_minor(total_minor: int, bps: int) -> int:
    """Refund in minor units, rounded down. Integer maths only: money never goes through float."""
    return total_minor * bps // 10000
