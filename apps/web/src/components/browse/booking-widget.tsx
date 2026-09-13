"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Price } from "@/components/ui/price";
import { useBrowseCopy } from "@/lib/browse-copy";
import { bookingModeLabel, type Experience } from "@/lib/catalog";

export function BookingWidget({ experience }: { experience: Experience }) {
  const copy = useBrowseCopy();
  const [guests, setGuests] = React.useState(2);
  const total = experience.priceFrom * guests;

  return (
    <aside className="rounded-card border border-border bg-surface-raised p-6 shadow-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-text-muted">{copy.estimatedFrom}</p>
      <Price amount={experience.priceFrom} estimate={experience.priceLabel !== "from"} period={copy.perPerson} />
      <p className="mt-2 text-sm text-text-muted">{copy.previewNote}</p>
      <p className="mt-1 text-sm font-medium text-text">{bookingModeLabel(experience.bookingMode)}</p>
      <div className="mt-6 grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="booking-date">{copy.chooseDate}</Label>
          <Input id="booking-date" type="date" name="date" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="booking-guests">{copy.guests}</Label>
          <Input
            id="booking-guests"
            type="number"
            min={1}
            max={20}
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value) || 1)}
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">{copy.estimatedTotal}</span>
          <span className="font-semibold">${total}</span>
        </div>
        <Button type="button" className="rounded-pill" disabled>
          {copy.previewNote}
        </Button>
        <Button asChild variant="outline" className="rounded-pill">
          <Link href={`/plan?add=${experience.slug}`}>{copy.addToDayPlan}</Link>
        </Button>
      </div>
    </aside>
  );
}
