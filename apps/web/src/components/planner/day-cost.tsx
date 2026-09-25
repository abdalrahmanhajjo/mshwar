"use client";

import * as React from "react";
import { Car, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { formatMinor, requestDayDriver, type DayPrice, type PriceLine } from "@/lib/planner";
import type { PlannerCopy, PlannerKey } from "@/lib/planner-copy";

/** One line's amount: an exact figure, a range, "from", or "price on request" - never a made-up $0. */
export function lineAmount(line: PriceLine, copy: PlannerCopy): string {
  if (line.basis === "exchange_rate") return copy.basis_exchange_rate;
  if (line.low_minor === null) return copy.priceOnRequest;
  const low = formatMinor(line.low_minor, line.currency);
  if (line.high_minor === null) return interpolate(copy.totalFrom, { amount: low });
  if (line.high_minor === line.low_minor) return low;
  return interpolate(copy.totalRange, { low, high: formatMinor(line.high_minor, line.currency) });
}

/** The day's total: a single figure, a range, or "from" when any line has no published ceiling. */
export function dayTotal(pricing: DayPrice, copy: PlannerCopy): string {
  const low = formatMinor(pricing.low_minor, pricing.currency);
  if (pricing.high_minor === null) return interpolate(copy.totalFrom, { amount: low });
  if (pricing.high_minor === pricing.low_minor) return low;
  return interpolate(copy.totalRange, { low, high: formatMinor(pricing.high_minor, pricing.currency) });
}

function perPerson(pricing: DayPrice, copy: PlannerCopy): string {
  const low = formatMinor(pricing.per_person_low_minor, pricing.currency);
  if (pricing.per_person_high_minor === null) return interpolate(copy.totalFrom, { amount: low });
  if (pricing.per_person_high_minor === pricing.per_person_low_minor)
    return interpolate(copy.perPerson, { amount: low });
  return interpolate(copy.perPersonRange, { low, high: formatMinor(pricing.per_person_high_minor, pricing.currency) });
}

function lineDetail(line: PriceLine, copy: PlannerCopy): string | null {
  // The amount column already says "price on request" or "no fee"; the note says why.
  if (line.basis === "on_request" || line.basis === "exchange_rate") return null;
  const basis = copy[`basis_${line.basis}` as PlannerKey];
  if (line.quantity > 1 && line.unit_low_minor !== null) {
    return `${basis} · ${interpolate(copy.unitTimes, {
      count: line.quantity,
      amount: formatMinor(line.unit_low_minor, line.currency),
    })}`;
  }
  return basis;
}

/** Every step's price with what it is based on, the day's total as a range, per person, and the budget. */
export function DayCostPanel({ pricing, copy }: { pricing: DayPrice; copy: PlannerCopy }) {
  const { locale } = useLocale();
  const budget = pricing.budget_minor ? formatMinor(pricing.budget_minor, pricing.currency) : null;
  const budgetText =
    budget && pricing.budget_status !== "unknown"
      ? interpolate(copy[`budget_${pricing.budget_status}` as PlannerKey], { budget })
      : null;
  return (
    <section
      aria-labelledby="day-cost-heading"
      className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7"
    >
      <div className="grid gap-1">
        <h3 id="day-cost-heading" className="title-card">
          {copy.dayCostTitle}
        </h3>
        <p className="text-sm text-text-muted">{copy.dayCostBody}</p>
      </div>
      <dl className="grid gap-3 text-sm">
        {pricing.lines.map((line, index) => (
          <div key={`${line.kind}-${line.order ?? "day"}-${index}`} className="flex justify-between gap-3">
            <dt className="grid gap-0.5">
              <span className="font-medium text-text">{line.label}</span>
              {lineDetail(line, copy) ? <span className="text-text-muted">{lineDetail(line, copy)}</span> : null}
              {line.note ? <span className="text-xs text-text-muted">{line.note}</span> : null}
              {line.source_name && line.source_url ? (
                <a
                  href={line.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-text-muted underline underline-offset-2"
                >
                  {interpolate(copy.priceSource, {
                    source: line.source_name,
                    date: line.checked_on ? formatDate(locale, `${line.checked_on}T12:00:00Z`) : "",
                  })}
                </a>
              ) : null}
            </dt>
            <dd className="tabular-nums text-end">{lineAmount(line, copy)}</dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2 border-t border-border-subtle pt-5">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
          {copy.estimateLabel}
        </p>
        <p className="text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">
          {dayTotal(pricing, copy)}
        </p>
        <p className="text-sm text-text-muted">{perPerson(pricing, copy)}</p>
        {pricing.on_request_lines > 0 ? (
          <p className="text-sm text-text-muted">
            {interpolate(copy.onRequestCount, { count: pricing.on_request_lines })}
          </p>
        ) : null}
        {pricing.other_currency_lines > 0 ? (
          <p className="text-sm text-text-muted">
            {interpolate(copy.otherCurrency, { count: pricing.other_currency_lines })}
          </p>
        ) : null}
        {budgetText ? (
          <Notice tone={pricing.budget_status === "within" ? "success" : "warning"}>{budgetText}</Notice>
        ) : null}
      </div>
    </section>
  );
}

/** Send the planned day to the verified drivers who cover it. They quote; the traveller chooses in Rides. */
export function DriverRequestPanel({ sessionId, copy }: { sessionId: string; copy: PlannerCopy }) {
  const [pickup, setPickup] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await requestDayDriver(sessionId, { pickup_name: pickup.trim() });
      setMessage({ tone: "success", text: copy.driverSent });
    } catch (caught) {
      setMessage({ tone: "danger", text: caught instanceof Error ? caught.message : copy.updateError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="driver-heading"
      className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7"
    >
      <div className="grid gap-1">
        <h3 id="driver-heading" className="title-card inline-flex items-center gap-2">
          <Car className="size-5" aria-hidden />
          {copy.driverTitle}
        </h3>
        <p className="text-sm text-text-muted">{copy.driverBody}</p>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void send(event)}>
        <div className="grid min-w-60 flex-1 gap-1.5">
          <Label htmlFor="driver-pickup">{copy.driverPickup}</Label>
          <Input
            id="driver-pickup"
            value={pickup}
            required
            minLength={3}
            maxLength={160}
            onChange={(event) => setPickup(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy || pickup.trim().length < 3}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send aria-hidden />}
          {copy.driverSend}
        </Button>
      </form>
      {message ? (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
    </section>
  );
}
