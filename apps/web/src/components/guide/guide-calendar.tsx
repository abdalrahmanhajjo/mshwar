"use client";

import * as React from "react";
import { CalendarDays, CalendarOff, CalendarPlus, Loader2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { interpolate } from "@/i18n/catalogues";
import { ApiError } from "@/lib/api/client";
import { useGuideWorkCopy, type GuideWorkKey } from "@/lib/guide-work-copy";
import {
  fetchAvailability,
  fetchMyTours,
  openTourDates,
  saveAvailability,
  type GuideAvailability,
  type GuideTour,
  type WeeklyStart,
} from "@/lib/guide-work";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Keep the pattern sorted and free of duplicates, whatever order it was typed in. */
export function normalisePattern(pattern: WeeklyStart[]): WeeklyStart[] {
  const seen = new Set<string>();
  return pattern
    .filter((entry) => /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.start))
    .filter((entry) => {
      const key = `${entry.weekday}-${entry.start}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
}

function Calendar() {
  const copy = useGuideWorkCopy();
  const [value, setValue] = React.useState<GuideAvailability | null>(null);
  const [tours, setTours] = React.useState<GuideTour[]>([]);
  const [failed, setFailed] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [newStart, setNewStart] = React.useState<Record<number, string>>({});
  const [dayOff, setDayOff] = React.useState("");
  const [dayOffReason, setDayOffReason] = React.useState("");
  const [opening, setOpening] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchAvailability(), fetchMyTours()])
      .then(([availability, rows]) => {
        if (!cancelled) {
          setValue(availability);
          setTours(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.loadError}
      </Notice>
    );
  }
  if (!value) {
    return (
      <div className="grid place-items-center py-16 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  const update = (patch: Partial<GuideAvailability>) => setValue({ ...value, ...patch });
  const pattern = normalisePattern(value.pattern);

  async function onSave() {
    if (!value) {
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      setValue(await saveAvailability({ ...value, pattern: normalisePattern(value.pattern) }));
      setNotice(copy.calendarSaved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  async function onOpen(tour: GuideTour) {
    setOpening(tour.id);
    setError(null);
    setNotice(null);
    try {
      const run = await openTourDates(tour.id);
      const opened = interpolate(copy.tourDatesOpened, { n: String(run.created) });
      setNotice(
        run.skipped_for_daily_cap
          ? `${tour.title}: ${opened} ${interpolate(copy.tourDatesCapped, { n: String(run.skipped_for_daily_cap) })}`
          : `${tour.title}: ${opened}`,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setOpening(null);
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.portalKicker}
        icon={<CalendarDays aria-hidden />}
        title={copy.calendarTitle}
        description={copy.calendarBody}
      />
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {notice ? (
        <Notice tone="success" role="status">
          {notice}
        </Notice>
      ) : null}

      <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
        <ul className="grid divide-y divide-border-subtle">
          {WEEKDAYS.map((weekday) => {
            const starts = pattern.filter((entry) => entry.weekday === weekday);
            const label = copy[`weekday${weekday}` as GuideWorkKey];
            return (
              <li
                key={weekday}
                className="grid gap-2 py-3 sm:grid-cols-[8rem_1fr_auto] sm:items-center"
                aria-label={label}
              >
                <span className="font-medium">{label}</span>
                <span className="flex flex-wrap gap-2">
                  {starts.length ? (
                    starts.map((entry) => (
                      <Badge key={entry.start} variant="secondary" className="gap-1 tabular-nums">
                        {entry.start}
                        <button
                          type="button"
                          aria-label={`${copy.calendarRemoveStart} ${label} ${entry.start}`}
                          className="rounded-full p-0.5 hover:bg-surface-sunken"
                          onClick={() =>
                            update({
                              pattern: value.pattern.filter(
                                (item) => !(item.weekday === weekday && item.start === entry.start),
                              ),
                            })
                          }
                        >
                          <X className="size-3" aria-hidden />
                        </button>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-text-muted">{copy.calendarNoStarts}</span>
                  )}
                </span>
                <span className="flex gap-2">
                  <Input
                    type="time"
                    aria-label={`${copy.calendarAddStart} ${label}`}
                    className="w-32"
                    value={newStart[weekday] ?? "10:00"}
                    onChange={(event) => setNewStart({ ...newStart, [weekday]: event.target.value })}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`${copy.calendarAddStart} ${label}`}
                    onClick={() =>
                      update({
                        pattern: normalisePattern([
                          ...value.pattern,
                          { weekday, start: (newStart[weekday] ?? "10:00").slice(0, 5) },
                        ]),
                      })
                    }
                  >
                    <Plus aria-hidden />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>

        <div className="grid gap-4 border-t border-border-subtle pt-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="notice-hours">{copy.calendarNotice}</Label>
            <Input
              id="notice-hours"
              type="number"
              min={0}
              max={720}
              value={value.min_notice_hours}
              onChange={(event) => update({ min_notice_hours: Number(event.target.value) })}
            />
            <p className="text-xs text-text-muted">{copy.calendarNoticeHint}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="daily-cap">{copy.calendarCap}</Label>
            <Input
              id="daily-cap"
              type="number"
              min={1}
              max={8}
              value={value.max_tours_per_day}
              onChange={(event) => update({ max_tours_per_day: Number(event.target.value) })}
            />
            <p className="text-xs text-text-muted">{copy.calendarCapHint}</p>
          </div>
        </div>

        <fieldset className="grid gap-3 border-t border-border-subtle pt-4">
          <legend className="flex items-center gap-2 pb-1 text-sm font-medium">
            <CalendarOff className="size-4 text-text-muted" aria-hidden />
            {copy.calendarDaysOff}
          </legend>
          {value.exceptions.length ? (
            <ul className="flex flex-wrap gap-2">
              {value.exceptions.map((entry) => (
                <li key={entry.local_date}>
                  <Badge variant="outline" className="gap-1.5 tabular-nums">
                    {entry.local_date}
                    {entry.reason ? <span className="text-text-muted">· {entry.reason}</span> : null}
                    <button
                      type="button"
                      aria-label={`${copy.calendarRemoveStart} ${entry.local_date}`}
                      className="rounded-full p-0.5 hover:bg-surface-sunken"
                      onClick={() =>
                        update({ exceptions: value.exceptions.filter((item) => item.local_date !== entry.local_date) })
                      }
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <Input
              type="date"
              aria-label={copy.calendarAddDayOff}
              value={dayOff}
              onChange={(event) => setDayOff(event.target.value)}
            />
            <Input
              aria-label={copy.calendarReason}
              placeholder={copy.calendarReason}
              value={dayOffReason}
              onChange={(event) => setDayOffReason(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={!dayOff}
              onClick={() => {
                update({
                  exceptions: [
                    ...value.exceptions.filter((item) => item.local_date !== dayOff),
                    { local_date: dayOff, reason: dayOffReason.trim() },
                  ].sort((a, b) => a.local_date.localeCompare(b.local_date)),
                });
                setDayOff("");
                setDayOffReason("");
              }}
            >
              <Plus aria-hidden />
              {copy.calendarAddDayOff}
            </Button>
          </div>
        </fieldset>

        <div>
          <Button type="button" disabled={pending} onClick={() => void onSave()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? copy.saving : copy.calendarSave}
          </Button>
        </div>
      </section>

      {tours.length ? (
        <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
          <h2 className="title-section text-[1.15rem]">{copy.calendarOpenTitle}</h2>
          <p className="text-sm text-text-muted">{copy.calendarOpenBody}</p>
          <ul className="grid gap-2">
            {tours.map((tour) => (
              <li
                key={tour.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle bg-surface px-3 py-2"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{tour.title}</span>
                  <Badge variant="outline">{interpolate(copy.tourUpcoming, { n: String(tour.upcoming_slots) })}</Badge>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={opening !== null || pattern.length === 0}
                  onClick={() => void onOpen(tour)}
                >
                  {opening === tour.id ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <CalendarPlus aria-hidden />
                  )}
                  {copy.tourOpenDates}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** /guide/calendar: the availability view, as a weekly rhythm rather than opening hours. */
export function GuideCalendar() {
  return <ApprovedGuide>{() => <Calendar />}</ApprovedGuide>;
}
