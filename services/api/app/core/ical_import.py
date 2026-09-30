"""Reading a guide's other calendar (Google, Apple, Outlook) as busy time.

Two halves, both small on purpose:

* ``fetch_calendar`` reads a calendar address a guide pasted, through ``app.core.safe_fetch``:
  https only, public addresses only, the connection pinned to the checked address (no DNS
  rebinding), redirects re-checked one by one, and the body capped in size and time.
* ``busy_periods`` turns the file into start/end pairs. Nothing else is kept: not the title,
  the place, the guests or the notes. Free ("transparent") and cancelled events are skipped,
  and simple repeating events (daily, weekly, monthly, yearly) are expanded over the window
  the booking guard looks at.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core import safe_fetch

BEIRUT = ZoneInfo("Asia/Beirut")
MAX_BYTES = 2_000_000
TOTAL_SECONDS = 20.0  # the whole read, so a slow drip cannot hold the job
MAX_PERIODS = 2000
WINDOW_DAYS = 120
MAX_OCCURRENCES = 1000
MAX_ITERATIONS = 20_000


class CalendarFetchError(Exception):
    """A calendar could not be read. The message is safe to show the guide."""


@dataclass(frozen=True)
class BusyPeriod:
    starts_at: datetime
    ends_at: datetime

    def as_json(self) -> dict[str, str]:
        return {"starts_at": self.starts_at.isoformat(), "ends_at": self.ends_at.isoformat()}


# ---- Fetching -----------------------------------------------------------------------------

_MESSAGES = {
    safe_fetch.NOT_HTTPS: "only https:// calendar addresses can be read",
    safe_fetch.NOT_PUBLIC: "that address is not a public calendar",
    safe_fetch.NOT_FOUND: "the calendar's address could not be found",
    safe_fetch.TOO_LARGE: "the calendar is too large to read",
    safe_fetch.TOO_SLOW: "the calendar took too long to answer",
    safe_fetch.UNREACHABLE: "the calendar could not be reached",
    safe_fetch.TOO_MANY_REDIRECTS: "the calendar redirected too many times",
}


def fetch_calendar(url: str) -> str:
    """Read a calendar file from a guide-supplied https address (app.core.safe_fetch)."""
    try:
        text = safe_fetch.fetch_text(
            url,
            max_bytes=MAX_BYTES,
            user_agent="Mshwar-Calendar/1.0",
            accept="text/calendar, */*",
            total_seconds=TOTAL_SECONDS,
        )
    except safe_fetch.FetchRefused as exc:
        if exc.reason == safe_fetch.STATUS:
            raise CalendarFetchError(f"the calendar answered {exc.status}") from exc
        raise CalendarFetchError(_MESSAGES.get(exc.reason, "the calendar could not be read")) from exc
    if "BEGIN:VCALENDAR" not in text[:2000].upper():
        raise CalendarFetchError("that address is not a calendar file")
    return text


# ---- Parsing ------------------------------------------------------------------------------


def _unfold(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw[:1] in (" ", "\t") and lines:
            lines[-1] += raw[1:]
        elif raw:
            lines.append(raw)
    return lines


def _split(line: str) -> tuple[str, dict[str, str], str]:
    head, _, value = line.partition(":")
    name, *params = head.split(";")
    options: dict[str, str] = {}
    for param in params:
        key, _, val = param.partition("=")
        options[key.upper()] = val.strip('"')
    return name.upper(), options, value.strip()


def _zone(tzid: str | None) -> ZoneInfo:
    if not tzid:
        return BEIRUT
    try:
        return ZoneInfo(tzid)
    except (ZoneInfoNotFoundError, ValueError):
        # Outlook names ("GTB Standard Time") are not IANA names; the guide works in Beirut.
        return BEIRUT


def _moment(value: str, options: dict[str, str]) -> tuple[datetime, bool] | None:
    """A DTSTART/DTEND value as an aware datetime, and whether it was a whole day."""
    try:
        if options.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", value):
            day = datetime.strptime(value[:8], "%Y%m%d").date()
            return datetime.combine(day, time(0), BEIRUT), True
        if value.endswith("Z"):
            return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC), False
        return datetime.strptime(value[:15], "%Y%m%dT%H%M%S").replace(tzinfo=_zone(options.get("TZID"))), False
    except ValueError:
        return None


_DURATION = re.compile(r"^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$")


def _duration(value: str) -> timedelta | None:
    match = _DURATION.match(value)
    if not match:
        return None
    sign, weeks, days, hours, minutes, seconds = match.groups()
    delta = timedelta(
        weeks=int(weeks or 0),
        days=int(days or 0),
        hours=int(hours or 0),
        minutes=int(minutes or 0),
        seconds=int(seconds or 0),
    )
    return -delta if sign == "-" else delta


_WEEKDAYS = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}
_UNSUPPORTED = ("BYSETPOS", "BYYEARDAY", "BYWEEKNO", "BYHOUR", "BYMINUTE", "BYMONTHDAY", "BYMONTH")


@dataclass(frozen=True)
class _Rule:
    freq: str
    interval: int
    count: int | None
    until: datetime | None
    weekdays: tuple[int, ...]


def _rule(text: str) -> _Rule | None:
    """A repeat rule we can expand exactly, or None (then only the first start is kept)."""
    parts = dict(item.partition("=")[::2] for item in text.upper().split(";") if "=" in item)
    freq = parts.get("FREQ", "")
    if freq not in {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"} or any(key in parts for key in _UNSUPPORTED):
        return None
    if "BYDAY" in parts and freq != "WEEKLY":
        return None
    until = _moment(parts["UNTIL"], {}) if parts.get("UNTIL") else None
    return _Rule(
        freq=freq,
        interval=max(int(parts["INTERVAL"]) if parts.get("INTERVAL", "").isdigit() else 1, 1),
        count=int(parts["COUNT"]) if parts.get("COUNT", "").isdigit() else None,
        until=(until[0] + timedelta(days=1) if until[1] else until[0]) if until else None,
        weekdays=tuple(sorted({_WEEKDAYS[d[-2:]] for d in parts.get("BYDAY", "").split(",") if d[-2:] in _WEEKDAYS})),
    )


def _add_months(moment: datetime, months: int) -> datetime | None:
    index = moment.month - 1 + months
    try:
        return moment.replace(year=moment.year + index // 12, month=index % 12 + 1)
    except ValueError:
        return None  # 31 February: the rule skips that month


def _candidates(first: datetime, rule: _Rule, skip_days: int) -> Iterator[datetime]:
    """Every start the rule makes, in order, beginning near ``first + skip_days``."""
    if rule.freq == "WEEKLY":
        week_start = first - timedelta(days=first.weekday())
        step = skip_days // (7 * rule.interval)
        for _ in range(MAX_ITERATIONS):
            base = week_start + timedelta(weeks=step * rule.interval)
            yield from (
                base + timedelta(days=d)
                for d in rule.weekdays or (first.weekday(),)
                if base + timedelta(days=d) >= first
            )
            step += 1
        return
    step = skip_days // rule.interval if rule.freq == "DAILY" else 0
    months = rule.interval * (12 if rule.freq == "YEARLY" else 1)
    for _ in range(MAX_ITERATIONS):
        candidate = (
            first + timedelta(days=step * rule.interval) if rule.freq == "DAILY" else _add_months(first, step * months)
        )
        step += 1
        if candidate is not None:
            yield candidate


def _starts(first: datetime, text: str, since: datetime, until: datetime) -> list[datetime]:
    """Start times of a repeating event from ``since`` to ``until``."""
    rule = _rule(text)
    if rule is None:
        return [first]
    if rule.until is not None:
        until = min(until, rule.until)
    # Without COUNT, jump straight to the window instead of walking years of history.
    skip = max((since - first).days, 0) if rule.count is None else 0
    out: list[datetime] = []
    for seen, candidate in enumerate(_candidates(first, rule, skip)):
        if candidate > until or (rule.count is not None and seen >= rule.count) or len(out) >= MAX_OCCURRENCES:
            break
        if candidate >= since:
            out.append(candidate)
    return out


Props = dict[str, tuple[dict[str, str], str]]


def _vevents(lines: list[str]) -> Iterator[list[tuple[str, dict[str, str], str]]]:
    """Each VEVENT's own lines (alarms inside it are skipped)."""
    current: list[tuple[str, dict[str, str], str]] | None = None
    depth = 0
    for line in lines:
        name, options, value = _split(line)
        if current is None:
            if name == "BEGIN" and value.upper() == "VEVENT":
                current, depth = [], 0
        elif name == "BEGIN":
            depth += 1
        elif name == "END" and depth:
            depth -= 1
        elif name == "END":
            yield current
            current = None
        elif not depth:
            current.append((name, options, value))


def _fields(lines: list[tuple[str, dict[str, str], str]]) -> tuple[Props, set[datetime]]:
    props: Props = {}
    exdates: set[datetime] = set()
    for name, options, value in lines:
        if name == "EXDATE":
            exdates.update(parsed[0] for item in value.split(",") if (parsed := _moment(item, options)))
        else:
            props[name] = (options, value)
    return props, exdates


def _span(props: Props) -> tuple[datetime, timedelta] | None:
    """When a busy event starts and how long it lasts; None for free, cancelled or odd events."""
    if props.get("TRANSP", ({}, ""))[1].upper() == "TRANSPARENT":
        return None
    if props.get("STATUS", ({}, ""))[1].upper() == "CANCELLED" or "DTSTART" not in props:
        return None
    start = _moment(props["DTSTART"][1], props["DTSTART"][0])
    if start is None:
        return None
    end = _moment(props["DTEND"][1], props["DTEND"][0]) if "DTEND" in props else None
    if end is not None:
        length: timedelta | None = end[0] - start[0]
    elif "DURATION" in props:
        length = _duration(props["DURATION"][1])
    else:
        length = timedelta(days=1) if start[1] else None
    if length is None or length <= timedelta(0) or length > timedelta(days=31):
        return None
    return start[0], length


def busy_periods(text: str, now: datetime | None = None) -> list[BusyPeriod]:
    """Busy start/end pairs in the next 120 days (and anything still running now)."""
    now = now or datetime.now(UTC)
    horizon = now + timedelta(days=WINDOW_DAYS)
    periods: list[BusyPeriod] = []
    for lines in _vevents(_unfold(text)):
        props, exdates = _fields(lines)
        span = _span(props)
        if span is None:
            continue
        first, length = span
        # A moved single occurrence (RECURRENCE-ID) is its own event with its own times.
        repeating = "RRULE" in props and "RECURRENCE-ID" not in props
        starts = _starts(first, props["RRULE"][1], now - length, horizon) if repeating else [first]
        periods.extend(
            BusyPeriod(moment, moment + length)
            for moment in starts
            if moment not in exdates and moment + length > now and moment < horizon
        )
        if len(periods) >= MAX_PERIODS:
            break
    periods.sort(key=lambda period: period.starts_at)
    return periods[:MAX_PERIODS]
