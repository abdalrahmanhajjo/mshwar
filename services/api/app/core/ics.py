"""iCalendar (RFC 5545) for tour bookings and a guide's feed.

Only what a calendar needs: start, end, title, place and a short description. Text is
escaped and long lines are folded, so any calendar app reads the file the same way.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class CalendarEvent:
    uid: str
    starts_at: datetime
    ends_at: datetime
    summary: str
    location: str = ""
    description: str = ""
    url: str = ""
    cancelled: bool = False


def _escape(value: str) -> str:
    return (
        value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")
    )


def _stamp(moment: datetime) -> str:
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=UTC)
    return moment.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def _fold(line: str) -> str:
    """Fold at 75 octets, never inside a multi-byte character."""
    out: list[str] = []
    current = ""
    for char in line:
        if len((current + char).encode("utf-8")) > 75:
            out.append(current)
            current = " " + char
        else:
            current += char
    out.append(current)
    return "\r\n".join(out)


def calendar(events: Iterable[CalendarEvent], name: str = "Mshwar") -> str:
    now = _stamp(datetime.now(UTC))
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Mshwar//Tours//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(name)}",
    ]
    for event in events:
        lines += [
            "BEGIN:VEVENT",
            f"UID:{event.uid}",
            f"DTSTAMP:{now}",
            f"DTSTART:{_stamp(event.starts_at)}",
            f"DTEND:{_stamp(event.ends_at)}",
            f"SUMMARY:{_escape(event.summary)}",
        ]
        if event.location:
            lines.append(f"LOCATION:{_escape(event.location)}")
        if event.description:
            lines.append(f"DESCRIPTION:{_escape(event.description)}")
        if event.url:
            lines.append(f"URL:{event.url}")
        lines.append(f"STATUS:{'CANCELLED' if event.cancelled else 'CONFIRMED'}")
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"
