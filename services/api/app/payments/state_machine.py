from __future__ import annotations

from collections.abc import Mapping

BOOKING_STATES: frozenset[str] = frozenset(
    {"draft", "pending", "confirmed", "rejected", "cancelled", "completed", "refunded"}
)

# expired is retained from the inventory hold path (MSHWAR-82) and is terminal.
ALL_BOOKING_STATUSES: frozenset[str] = BOOKING_STATES | frozenset({"expired"})

ALLOWED_TRANSITIONS: Mapping[str, frozenset[str]] = {
    "draft": frozenset({"pending", "cancelled"}),
    "pending": frozenset({"confirmed", "rejected", "cancelled", "expired"}),
    "confirmed": frozenset({"cancelled", "completed", "refunded"}),
    "rejected": frozenset(),
    "cancelled": frozenset({"refunded"}),
    "expired": frozenset(),
    "completed": frozenset({"refunded"}),
    "refunded": frozenset(),
}


def allowed(from_status: str, to_status: str) -> bool:
    if from_status == to_status:
        return True
    return to_status in ALLOWED_TRANSITIONS.get(from_status, frozenset())


def blocked_pairs() -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    for source in ALL_BOOKING_STATUSES:
        for target in ALL_BOOKING_STATUSES:
            if source != target and not allowed(source, target):
                pairs.append((source, target))
    return pairs
