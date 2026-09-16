"use client";

import * as React from "react";
import { ArrowUpRight, Info } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useBrowseCopy } from "@/lib/browse-copy";
import { bookingModeCopy, useCheckoutCopy } from "@/lib/checkout-copy";
import { listingAvailable, priceKindLabel, type Experience } from "@/lib/catalog";
import { formatCurrency } from "@/i18n/format";
import { useLocale } from "@/components/shell/locale-provider";
import { cn, focusRing } from "@/lib/utils";

export function BookingWidget({ experience }: { experience: Experience }) {
  const copy = useBrowseCopy();
  const checkout = useCheckoutCopy();
  const { locale } = useLocale();
  const [guests, setGuests] = React.useState(2);
  const total = experience.priceFrom * guests;
  const available = listingAvailable(experience);
  const isQuote = experience.priceLabel === "quote";
  const priceLabel = isQuote ? copy.quoteRequired : priceKindLabel(experience.priceLabel);
  const money = (value: number) => formatCurrency(locale, value, "USD", { maximumFractionDigits: 0 });

  return (
    <aside
      aria-label={copy.bookingPanelTitle}
      className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-md md:p-7 lg:sticky lg:top-24"
    >
      <div className="grid gap-2">
        <p className="text-sm text-text-muted">{priceLabel}</p>
        {isQuote ? (
          <p className="text-[2rem] font-semibold leading-none tracking-[-0.03em]">{copy.quoteRequired}</p>
        ) : (
          <p className="flex items-baseline gap-1.5">
            <span className="text-[2.4rem] font-semibold leading-none tracking-[-0.04em]">
              {money(experience.priceFrom)}
            </span>
            <span className="text-sm text-text-muted">/ {copy.perPerson}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent">{copy.previewNote}</Badge>
          {available ? null : <Badge variant="outline">{copy.availabilityUnknown}</Badge>}
        </div>
        <p className="text-sm font-medium text-text">{bookingModeCopy(experience.bookingMode, locale)}</p>
      </div>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="booking-date">{copy.chooseDate}</Label>
          <Input id="booking-date" type="date" name="date" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="booking-guests">{copy.guests}</Label>
          <NativeSelect
            id="booking-guests"
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value) || 1)}
          >
            {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? copy.personLabel : copy.peopleLabel}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {isQuote ? null : (
        <dl className="grid gap-3 border-t border-border-subtle pt-4 text-sm">
          <div className="flex items-center justify-between gap-3 text-text-muted">
            <dt>
              {money(experience.priceFrom)} × {guests} {guests === 1 ? copy.personLabel : copy.peopleLabel}
            </dt>
            <dd className="tabular-nums">{money(total)}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3 text-base font-semibold">
            <dt>{copy.estimatedTotal}</dt>
            <dd className="tabular-nums">${total}</dd>
          </div>
        </dl>
      )}
      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <LocaleLink href={`/checkout?listing=${experience.slug}`}>
            {checkout.continueCheckout}
            <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
          </LocaleLink>
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
          <Info className="size-3.5" aria-hidden />
          {copy.noChargeNote}
        </p>
        <LocaleLink
          href={`/plan?add=${experience.slug}`}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-sm text-sm font-semibold text-text hover:underline",
            focusRing,
          )}
        >
          {copy.addToDayPlan}
          <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
        </LocaleLink>
      </div>
    </aside>
  );
}
