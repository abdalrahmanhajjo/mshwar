"""Bulk-record prices staff checked at the official source (migration 047).

Staff collect published prices - the site's own ticket page, the ministry's
list, the ticket office board - into a CSV, one row per place:

    slug,price_type,amount,max_amount,currency,unit,source_url,source_name,checked_on,review_by,note
    jeita-grotto,fixed,18.00,,USD,person,https://...,Jeita Grotto official site,2026-09-20,,Adult ticket

Amounts are in the currency's main unit (dollars). Every row goes through
``app.admin_set_sourced_price``, so the database enforces the same rules as the
admin screen: a https source and its name, a check in the last 60 days, a review
within a year, and an ended - never deleted - previous price. Nothing is
recorded without a source; a row that fails is reported and skipped.
"""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import ValidationError

from app.planner.schemas import SourcedPriceIn

COLUMNS = (
    "slug",
    "price_type",
    "amount",
    "max_amount",
    "currency",
    "unit",
    "source_url",
    "source_name",
    "checked_on",
    "review_by",
    "note",
)


@dataclass(frozen=True)
class PriceRow:
    line: int
    slug: str
    payload: SourcedPriceIn


@dataclass(frozen=True)
class RowError:
    line: int
    slug: str
    reason: str


def _minor(value: str) -> int | None:
    text = (value or "").strip().replace(",", "")
    if not text:
        return None
    try:
        amount = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f"not an amount: {value!r}") from exc
    if amount < 0 or amount != amount.quantize(Decimal("0.01")):
        raise ValueError(f"amounts are positive with at most two decimals: {value!r}")
    return int(amount * 100)


def read_rows(text: str) -> tuple[list[PriceRow], list[RowError]]:
    """Parse and validate the CSV. Rows with a problem are returned as errors, never guessed."""
    reader = csv.DictReader(io.StringIO(text))
    missing = [
        column
        for column in ("slug", "price_type", "amount", "source_url", "source_name", "checked_on")
        if column not in (reader.fieldnames or [])
    ]
    if missing:
        return [], [RowError(1, "", f"missing columns: {', '.join(missing)}")]
    rows: list[PriceRow] = []
    errors: list[RowError] = []
    for line, raw in enumerate(reader, start=2):
        slug = (raw.get("slug") or "").strip()
        try:
            body: dict[str, Any] = {
                "price_type": (raw.get("price_type") or "").strip(),
                "amount_minor": _minor(raw.get("amount") or ""),
                "max_amount_minor": _minor(raw.get("max_amount") or ""),
                "currency": (raw.get("currency") or "USD").strip().upper() or "USD",
                "unit": (raw.get("unit") or "person").strip() or "person",
                "source_url": (raw.get("source_url") or "").strip(),
                "source_name": (raw.get("source_name") or "").strip(),
                "checked_on": (raw.get("checked_on") or "").strip(),
                "review_by": (raw.get("review_by") or "").strip() or None,
                "note": (raw.get("note") or "").strip(),
            }
            if not slug:
                raise ValueError("slug is empty")
            rows.append(PriceRow(line, slug, SourcedPriceIn.model_validate(body)))
        except (ValueError, ValidationError) as exc:
            errors.append(RowError(line, slug, str(exc).splitlines()[0]))
    return rows, errors


def record(conn: Any, admin_email: str, rows: list[PriceRow], *, dry_run: bool) -> tuple[int, list[RowError]]:
    """Record each row through the database function, one savepoint per row. Dry runs roll back."""
    admin = conn.execute("SELECT id FROM app.users WHERE lower(email) = lower(%s)", (admin_email,)).fetchone()
    if admin is None:
        raise ValueError(f"no user with email {admin_email}")
    recorded = 0
    errors: list[RowError] = []
    for row in rows:
        listing = conn.execute("SELECT id FROM app.experiences WHERE slug = %s", (row.slug,)).fetchone()
        if listing is None:
            errors.append(RowError(row.line, row.slug, "no listing with this slug"))
            continue
        try:
            with conn.transaction():
                conn.execute(
                    "SELECT app.admin_set_sourced_price(%s, %s, %s::jsonb)",
                    (admin[0], listing[0], json.dumps(row.payload.model_dump(mode="json", exclude_none=True))),
                )
            recorded += 1
        except Exception as exc:  # noqa: BLE001 - reported per row, the rest continue
            errors.append(RowError(row.line, row.slug, str(exc).splitlines()[0]))
    if dry_run:
        conn.rollback()
    else:
        conn.commit()
    return recorded, errors


__all__ = ["COLUMNS", "PriceRow", "RowError", "read_rows", "record"]
