"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{copy.hoursTitle}</CardTitle>
          <CardDescription>{copy.generateSlots}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button type="button" variant="outline" onClick={() => void onHours()}>
            {copy.hoursTitle}
          </Button>
          <Label htmlFor="capacity">{copy.capacity}</Label>
          <Input id="capacity" value={capacity} onChange={(event) => setCapacity(event.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input aria-label="start" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
            <Input aria-label="end" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </div>
          <Label htmlFor="exception-date">{copy.datedException}</Label>
          <Input
            id="exception-date"
            type="date"
            value={exceptionDate}
            onChange={(event) => setExceptionDate(event.target.value)}
          />
          <Button type="button" variant="secondary" onClick={() => void onException()}>
            {copy.datedException}
          </Button>
          <Button type="button" onClick={() => void onGenerate()}>
            {copy.generateSlots}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.calendarWeek}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border p-3"
            >
              <span className="text-sm">
                {new Date(slot.starts_at).toLocaleString()} · {copy.remaining} {slot.remaining}/{slot.capacity}
                {slot.blacked_out ? ` · ${copy.blackout}` : ""}
              </span>
              <Button type="button" variant="secondary" onClick={() => void onBlackout(slot.id, slot.starts_at)}>
                {copy.blackout}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
