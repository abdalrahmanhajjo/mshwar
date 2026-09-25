"""What a whole day costs, line by line, from published prices only.

Every line says what its amount is based on, so the traveller can tell a fixed
ticket from a restaurant's own "typical spend" or a stay's "from" price:

==================  ===========================================================
basis               source
==================  ===========================================================
fixed / free        the listing's price rule (a published 0 is really free)
from                price rule with a floor only: the day total is open-ended
range               price rule with a floor and a ceiling
estimated           price rule marked estimated by its owner
typical_spend       the restaurant's own typical spend per person (046)
per_night_from      the stay's "from" price per night, per room (043)
driver_day_rate     published day rates of the verified drivers who would be asked
exchange_rate       a money changer: no Mshwar fee, the posted rate applies
on_request          nothing published: never counted as free
==================  ===========================================================

Totals are summed in the plan's currency only; a line in another currency is
shown but not added. The stored trip total is still summed by Postgres from the
stops' lower bounds; this breakdown is what the traveller reads.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.planner.schemas import StepCandidate

Basis = Literal[
    "fixed",
    "free",
    "from",
    "range",
    "estimated",
    "typical_spend",
    "per_night_from",
    "driver_day_rate",
    "exchange_rate",
    "on_request",
]
#: The price kinds a saved stop understands (trip_stops.price_kind).
_PRICE_KIND: dict[str, str] = {"fixed": "fixed", "free": "fixed", "on_request": "quote"}


class PriceLine(BaseModel):
    order: int | None = None
    kind: Literal["stop", "stay", "driver", "exchange"]
    label: str
    basis: Basis
    unit: Literal["person", "group", "night", "day", "visit"] = "visit"
    quantity: int = 1
    unit_low_minor: int | None = None
    #: None with a low amount means "from": there is no published ceiling.
    unit_high_minor: int | None = None
    low_minor: int | None = None
    high_minor: int | None = None
    currency: str = "USD"
    source: str = "none"
    note: str = ""

    @property
    def priced(self) -> bool:
        return self.low_minor is not None

    @property
    def price_kind(self) -> str:
        return _PRICE_KIND.get(self.basis, "estimate")


class DayPrice(BaseModel):
    currency: str
    party_size: int
    lines: list[PriceLine] = Field(default_factory=list)
    low_minor: int = 0
    #: None when any line is open-ended ("from"): the day costs at least ``low_minor``.
    high_minor: int | None = 0
    per_person_low_minor: int = 0
    per_person_high_minor: int | None = 0
    priced_lines: int = 0
    on_request_lines: int = 0
    other_currency_lines: int = 0
    budget_minor: int | None = None
    #: "within", "over", "may_exceed" (the range straddles the budget) or "unknown".
    budget_status: str = "unknown"


def _money(value: Any) -> int | None:
    try:
        return None if value is None else int(value)
    except (TypeError, ValueError):
        return None


def _line(
    base: dict[str, Any], basis: Basis, unit: str, quantity: int, low: int | None, high: int | None, **extra: Any
) -> PriceLine:
    return PriceLine(
        **base,
        basis=basis,
        unit=unit,  # type: ignore[arg-type]
        quantity=quantity,
        unit_low_minor=low,
        unit_high_minor=high,
        low_minor=None if low is None else low * quantity,
        high_minor=None if high is None else high * quantity,
        **extra,
    )


def _from_rule(candidate: StepCandidate, party: int, base: dict[str, Any]) -> PriceLine | None:
    price = candidate.price or {}
    amount = _money(price.get("amount_minor"))
    has_rule = price.get("has_rule", amount is not None)
    kind = str(price.get("type") or "")
    if not has_rule or amount is None or kind in {"quote", "quote-required"}:
        return None
    unit = "person" if price.get("unit", "person") == "person" else "group"
    quantity = party if unit == "person" else 1
    currency = str(price.get("currency") or "USD")
    common = {"currency": currency, "source": "price_rule"}
    if kind == "fixed" and amount == 0:
        return _line(base, "free", unit, quantity, 0, 0, **common)
    if kind == "range":
        high = _money(price.get("max_amount_minor"))
        return _line(base, "range", unit, quantity, amount, high, **common)
    if kind == "from":
        return _line(base, "from", unit, quantity, amount, None, **common)
    basis: Basis = "estimated" if kind == "estimated" else "fixed"
    return _line(base, basis, unit, quantity, amount, amount, **common)


def stop_price(candidate: StepCandidate, party: int, *, order: int | None = None, role: str = "") -> PriceLine:
    """The published price of one place for the party, or "on request" - never an invented amount."""
    kind = "stay" if role == "stay" or candidate.listing_kind == "hotel" else "stop"
    base: dict[str, Any] = {"order": order, "kind": kind, "label": candidate.title}
    ruled = _from_rule(candidate, party, base)
    if ruled is not None:
        return ruled
    details = getattr(candidate, "details", None) or {}
    currency = str(details.get("currency") or (candidate.price or {}).get("currency") or "USD")
    spend = _money(details.get("typical_spend_minor"))
    if spend is not None and kind == "stop":
        return _line(
            base,
            "typical_spend",
            "person",
            party,
            spend,
            spend,
            currency=currency,
            source="owner",
            note="The restaurant's own typical spend per person",
        )
    night = _money(details.get("price_from_minor"))
    if night is not None and kind == "stay":
        return _line(
            base,
            "per_night_from",
            "night",
            1,
            night,
            None,
            currency=currency,
            source="listing",
            note="From, per room per night; the stay confirms the price",
        )
    return PriceLine(**base, basis="on_request", currency=currency, note="No published price: ask the place")


def driver_price(rates: list[dict[str, Any]], currency: str) -> PriceLine:
    """What the drivers a day request would reach publish as their day rate."""
    base: dict[str, Any] = {"kind": "driver", "label": "Driver for the day"}
    chosen = next((rate for rate in rates if rate.get("currency") == currency), rates[0] if rates else None)
    low = _money(chosen.get("low_minor")) if chosen else None
    if chosen is None or low is None:
        return PriceLine(**base, basis="on_request", unit="day", currency=currency, note="Drivers quote a fixed price")
    drivers = int(chosen.get("drivers") or 0)
    return _line(
        base,
        "driver_day_rate",
        "day",
        1,
        low,
        _money(chosen.get("high_minor")),
        currency=str(chosen.get("currency") or currency),
        source="driver_terms",
        note=f"Published day rates of {drivers} verified driver{'s' if drivers != 1 else ''}; "
        "the driver you choose quotes a fixed price",
    )


def exchange_line(order: int, office: dict[str, Any]) -> PriceLine:
    """No Mshwar fee; the changer's posted rate applies. Shown, never added to the total."""
    rates = office.get("rates") or []
    latest = rates[0] if isinstance(rates, list) and rates and isinstance(rates[0], dict) else None
    note = "No fee from Mshwar; the changer's rate applies"
    if latest:
        note += f" (posted {latest.get('posted_at', '')}: buy {latest.get('buy')}, sell {latest.get('sell')})"
    return PriceLine(
        order=order,
        kind="exchange",
        label=str(office.get("branch_name") or "Money changer"),
        basis="exchange_rate",
        source="changer",
        note=note,
    )


def _budget_status(low: int, high: int | None, budget: int | None) -> str:
    if not budget:
        return "unknown"
    if low > budget:
        return "over"
    if high is not None and high <= budget:
        return "within"
    return "may_exceed"


def price_day(lines: list[PriceLine], *, currency: str, party: int, budget: int | None) -> DayPrice:
    """Sum what is published, in the plan's currency; say what is open-ended, on request or elsewhere."""
    low = 0
    high: int | None = 0
    priced = on_request = other = 0
    for line in lines:
        if line.basis == "exchange_rate":
            continue
        if line.basis == "on_request":
            on_request += 1
            continue
        if line.currency != currency:
            other += 1
            continue
        priced += 1
        low += line.low_minor or 0
        high = None if high is None or line.high_minor is None else high + line.high_minor
    people = max(party, 1)
    return DayPrice(
        currency=currency,
        party_size=people,
        lines=lines,
        low_minor=low,
        high_minor=high,
        per_person_low_minor=low // people,
        per_person_high_minor=None if high is None else -(-high // people),
        priced_lines=priced,
        on_request_lines=on_request,
        other_currency_lines=other,
        budget_minor=budget,
        budget_status=_budget_status(low, high, budget),
    )


__all__ = ["DayPrice", "PriceLine", "driver_price", "exchange_line", "price_day", "stop_price"]
