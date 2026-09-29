"use client";

import * as React from "react";
import { useLocale } from "@/components/shell/locale-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency } from "@/i18n/format";
import { PLANNED_FEE_PERCENT, estimateEarnings, type EarningsInput } from "@/lib/guide-earnings";
import { useGuideJoinCopy } from "@/lib/guide-join-copy";

const FIELDS: {
  key: keyof EarningsInput;
  label: "calcTourPrice" | "calcGuests" | "calcTours" | "calcDayRate" | "calcHireDays";
  max: number;
}[] = [
  { key: "tourPrice", label: "calcTourPrice", max: 10_000 },
  { key: "guestsPerTour", label: "calcGuests", max: 60 },
  { key: "toursPerWeek", label: "calcTours", max: 56 },
  { key: "dayRate", label: "calcDayRate", max: 10_000 },
  { key: "hiredDaysPerWeek", label: "calcHireDays", max: 7 },
];

// A starting point only; the guide replaces every number with their own.
const START: Record<keyof EarningsInput, string> = {
  tourPrice: "25",
  guestsPerTour: "6",
  toursPerWeek: "2",
  dayRate: "120",
  hiredDaysPerWeek: "1",
};

/** The guide's own prices in, an illustrative week and month out, today and with the planned fee. */
export function EarningsCalculator() {
  const copy = useGuideJoinCopy();
  const { locale } = useLocale();
  const [values, setValues] = React.useState(START);
  const estimate = estimateEarnings({
    tourPrice: Number(values.tourPrice),
    guestsPerTour: Number(values.guestsPerTour),
    toursPerWeek: Number(values.toursPerWeek),
    dayRate: Number(values.dayRate),
    hiredDaysPerWeek: Number(values.hiredDaysPerWeek),
  });
  const money = (value: number) => formatCurrency(locale, value, "USD", { maximumFractionDigits: 0 });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => event.preventDefault()}>
        {FIELDS.map((field) => (
          <div key={field.key} className="grid gap-1.5">
            <Label htmlFor={`calc-${field.key}`} className="text-brand-foreground/85">
              {copy[field.label]}
            </Label>
            <Input
              id={`calc-${field.key}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={field.max}
              value={values[field.key]}
              onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
              className="h-12 bg-surface-raised text-lg tabular-nums text-text"
            />
          </div>
        ))}
      </form>
      <div
        aria-live="polite"
        className="grid gap-5 rounded-[1.5rem] bg-surface-raised p-6 text-text shadow-[0_30px_60px_-30px_rgb(0_0_0/0.5)]"
      >
        <span className="w-fit rounded-pill bg-brand-subtle px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
          {copy.calcIllustrative}
        </span>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-1">
            <span className="text-sm text-text-muted">{copy.calcWeek}</span>
            <span className="text-3xl font-semibold tabular-nums tracking-[-0.03em]" data-testid="calc-week">
              {money(estimate.weekly)}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-sm text-text-muted">{copy.calcMonth}</span>
            <span
              className="text-3xl font-semibold tabular-nums tracking-[-0.03em] text-brand"
              data-testid="calc-month"
            >
              {money(estimate.monthly)}
            </span>
          </div>
        </div>
        <p className="border-t border-border-subtle pt-4 text-sm font-medium text-success">{copy.calcFeeNow}</p>
        <p className="text-sm text-text-muted">
          {interpolate(copy.calcFeeLater, {
            fee: String(PLANNED_FEE_PERCENT),
            net: money(estimate.monthlyAfterPlannedFee),
          })}
        </p>
      </div>
    </div>
  );
}
