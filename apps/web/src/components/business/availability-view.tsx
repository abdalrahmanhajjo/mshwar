"use client";

import * as React from "react";
import { ArrowLeft, Ban, CalendarPlus, CalendarX, Clock } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessCopy } from "@/lib/business-copy";
import {
  createBlackout,
  createOpeningException,
  generateSlots,
  getAvailability,
  getExperience,
  replaceHours,
} from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function AvailabilityView({ experienceId }: { experienceId: string }) {
  const copy = useBusinessCopy();
  const { org } = usePortal();
  const [capacity, setCapacity] = React.useState("8");
  const [start, setStart] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [end, setEnd] = React.useState(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [slots, setSlots] = React.useState<
    { id: string; starts_at: string; remaining: number; capacity: number; blacked_out: boolean }[]
  >([]);
  const [venueId, setVenueId] = React.useState<string | null>(null);
  const [exceptionDate, setExceptionDate] = React.useState(() => new Date().toISOString().slice(0, 10));

  const reload = React.useCallback(async () => {
    if (!org) {
      return;
    }
    const listing = await getExperience(org.id, experienceId);
    setVenueId(listing.venue_id);
    const availability = await getAvailability(org.id, experienceId);
    setSlots(availability.slots);
  }, [experienceId, org]);

  React.useEffect(() => {
    if (!org) {
      return;
    }
    let cancelled = false;
    void getExperience(org.id, experienceId)
      .then(async (listing) => {
        if (cancelled) {
          return;
        }
        setVenueId(listing.venue_id);
        const availability = await getAvailability(org.id, experienceId);
        if (!cancelled) {
          setSlots(availability.slots);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [experienceId, org]);

  async function onHours() {
    if (!org || !venueId) {
      return;
    }
    await replaceHours(org.id, {
      venue_id: venueId,
      hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "10:00", closes: "18:00" })),
      source: "portal",
    });
  }

  async function onException() {
    if (!org || !venueId) {
      return;
    }
    await createOpeningException(org.id, {
      venue_id: venueId,
      local_date: exceptionDate,
      closed: true,
      source: "portal",
    });
    await reload();
  }

  async function onGenerate() {
    if (!org) {
      return;
    }
    await generateSlots(org.id, {
      experience_id: experienceId,
      start_date: start,
      end_date: end,
      capacity: Number(capacity),
    });
    await reload();
  }

  async function onBlackout(slotId: string, starts: string) {
    if (!org) {
      return;
    }
    const slot = slots.find((item) => item.id === slotId);
    if (!slot) {
      return;
    }
    await createBlackout(org.id, {
      experience_id: experienceId,
      start: starts,
      end: new Date(new Date(starts).getTime() + 60 * 60 * 1000).toISOString(),
      reason: "Portal blackout",
    });
    await reload();
  }

  return (
    <div className="grid gap-8">
      <LocaleLink
        href="/business/listings"
        className="inline-flex w-fit items-center gap-2 rounded-sm text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {copy.listingsTitle}
      </LocaleLink>
      <PageHeader eyebrow={copy.portalKicker} title={copy.availabilityTitle} description={copy.hoursTitle} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.generateSlots}</CardTitle>
            <CardDescription>{copy.hoursTitle}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <Button type="button" variant="outline" onClick={() => void onHours()}>
              <Clock aria-hidden />
              {copy.hoursTitle}
            </Button>
            <div className="grid gap-2">
              <Label htmlFor="capacity">{copy.capacity}</Label>
              <Input id="capacity" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1.5 text-xs font-medium text-text-muted">
                {copy.fromLabel}
                <Input
                  aria-label="start"
                  type="date"
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-text-muted">
                {copy.toLabel}
                <Input aria-label="end" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
              </label>
            </div>
            <Button type="button" onClick={() => void onGenerate()}>
              <CalendarPlus aria-hidden />
              {copy.generateSlots}
            </Button>
            <div className="grid gap-2 border-t border-border-subtle pt-5">
              <Label htmlFor="exception-date">{copy.datedException}</Label>
              <div className="flex gap-2">
                <Input
                  id="exception-date"
                  type="date"
                  value={exceptionDate}
                  onChange={(event) => setExceptionDate(event.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => void onException()}>
                  <CalendarX aria-hidden />
                  <span className="sr-only sm:not-sr-only">{copy.datedException}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.slotsTitle}</CardTitle>
            <CardDescription>{copy.calendarWeek}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {slots.length === 0 ? <p className="text-sm text-text-muted">{copy.noSlotsYet}</p> : null}
            {slots.map((slot) => {
              const pct = slot.capacity ? Math.round(((slot.capacity - slot.remaining) / slot.capacity) * 100) : 0;
              return (
                <div
                  key={slot.id}
                  className={cn(
                    "grid gap-3 rounded-control border px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center",
                    slot.blacked_out ? "border-danger/30 bg-danger-subtle/50" : "border-border-subtle",
                  )}
                >
                  <div className="grid gap-1.5">
                    <p className="text-sm font-medium">
                      {new Date(slot.starts_at).toLocaleString()}
                      {slot.blacked_out ? ` · ${copy.blackout}` : ""}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-text-muted">
                      <span
                        className="h-1.5 w-28 overflow-hidden rounded-pill bg-brand-subtle"
                        aria-hidden
                        data-rtl-chart
                      >
                        <span className="block h-full rounded-pill bg-brand" style={{ width: `${pct}%` }} />
                      </span>
                      {copy.remaining} {slot.remaining}/{slot.capacity}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onBlackout(slot.id, slot.starts_at)}
                  >
                    <Ban aria-hidden />
                    {copy.blackout}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
