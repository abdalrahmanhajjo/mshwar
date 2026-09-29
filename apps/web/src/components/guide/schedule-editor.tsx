"use client";

import * as React from "react";
import { CalendarClock, Loader2, Pencil, Plus, Square, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideScheduleCopy, type GuideScheduleKey } from "@/lib/guide-schedule-copy";
import {
  WEEKDAYS,
  blankSchedule,
  scheduleBody,
  scheduleInput,
  scheduleProblems,
  sortTimes,
} from "@/lib/guide-schedule";
import {
  deleteSchedule,
  fetchSchedules,
  saveSchedule,
  type GuideTour,
  type ScheduleInput,
  type TourSchedule,
} from "@/lib/guide-work";
import { cn, focusRing } from "@/lib/utils";

function useDayLabel() {
  const { locale } = useLocale();
  return (localDate: string) =>
    formatDate(locale, `${localDate}T12:00:00Z`, { dateStyle: undefined, day: "numeric", month: "short" });
}

function Summary({ schedule }: { schedule: TourSchedule }) {
  const copy = useGuideScheduleCopy();
  const dayLabel = useDayLabel();
  const days =
    schedule.weekdays.length === 7
      ? copy.scheduleEveryDay
      : schedule.weekdays.map((day) => copy[`day${day}` as GuideScheduleKey]).join(", ");
  return (
    <div className="grid gap-1.5">
      <p className="font-medium">
        {days} · <span className="tabular-nums">{schedule.start_times.join(", ")}</span>
      </p>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Badge variant={schedule.mode === "private" ? "default" : "secondary"}>
          {schedule.mode === "private"
            ? copy.schedulePrivateShort
            : schedule.capacity
              ? interpolate(copy.scheduleSharedSeats, { n: String(schedule.capacity) })
              : copy.scheduleSharedGroup}
        </Badge>
        {schedule.min_group > 1 ? (
          <Badge variant="outline">{interpolate(copy.scheduleRunsWith, { n: String(schedule.min_group) })}</Badge>
        ) : null}
        <Badge variant="outline">
          {interpolate(copy.scheduleSince, { date: dayLabel(schedule.valid_from) })}
          {schedule.valid_to ? ` · ${interpolate(copy.scheduleUntil, { date: dayLabel(schedule.valid_to) })}` : ""}
        </Badge>
        <Badge variant="outline">{interpolate(copy.scheduleOpen, { n: String(schedule.upcoming_slots) })}</Badge>
      </div>
    </div>
  );
}

function ScheduleForm({
  tour,
  initial,
  onSaved,
  onCancel,
}: {
  tour: GuideTour;
  initial: ScheduleInput;
  onSaved: (created: number) => void;
  onCancel: () => void;
}) {
  const copy = useGuideScheduleCopy();
  const [value, setValue] = React.useState<ScheduleInput>(initial);
  const [time, setTime] = React.useState("10:00");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();
  const update = (patch: Partial<ScheduleInput>) => setValue((current) => ({ ...current, ...patch }));
  const problems = scheduleProblems(value);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (problems.length) {
      setError(problems.map((key) => copy[key]).join(" "));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const saved = await saveSchedule(tour.id, scheduleBody(value));
      onSaved(saved.created);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-control border border-border-subtle bg-surface p-4" onSubmit={onSubmit}>
      <fieldset className="grid gap-2">
        <legend className="pb-1 text-sm font-medium">{copy.scheduleDays}</legend>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => {
            const on = value.weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  update({ weekdays: on ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day] })
                }
                className={cn(
                  "min-w-12 rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
                  on
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border-subtle bg-surface-raised text-text-muted hover:text-text",
                  focusRing,
                )}
              >
                {copy[`day${day}` as GuideScheduleKey]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="pb-1 text-sm font-medium">{copy.scheduleTimes}</legend>
        <div className="flex flex-wrap items-center gap-2">
          {sortTimes(value.start_times).map((start) => (
            <Badge key={start} variant="secondary" className="gap-1 tabular-nums">
              {start}
              <button
                type="button"
                aria-label={interpolate(copy.scheduleTimeRemove, { time: start })}
                className="rounded-full p-0.5 hover:bg-surface-sunken"
                onClick={() => update({ start_times: value.start_times.filter((item) => item !== start) })}
              >
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
          <Input
            type="time"
            aria-label={copy.scheduleTimeAdd}
            className="w-32"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => update({ start_times: sortTimes([...value.start_times, time]) })}
          >
            <Plus aria-hidden />
            {copy.scheduleTimeAdd}
          </Button>
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="pb-1 text-sm font-medium">{copy.scheduleSeason}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-from`}>{copy.scheduleFrom}</Label>
            <Input
              id={`${id}-from`}
              type="date"
              value={value.valid_from ?? ""}
              onChange={(event) => update({ valid_from: event.target.value || null })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-to`}>{copy.scheduleTo}</Label>
            <Input
              id={`${id}-to`}
              type="date"
              value={value.valid_to ?? ""}
              onChange={(event) => update({ valid_to: event.target.value || null })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="pb-1 text-sm font-medium">{copy.scheduleMode}</legend>
        {(["shared", "private"] as const).map((mode) => (
          <label key={mode} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${id}-mode`}
              value={mode}
              checked={value.mode === mode}
              onChange={() => update({ mode })}
              className="size-4 accent-brand"
            />
            {mode === "shared" ? copy.scheduleShared : copy.schedulePrivate}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-seats`}>{copy.scheduleSeats}</Label>
          <Input
            id={`${id}-seats`}
            type="number"
            min={1}
            max={60}
            placeholder={String(tour.max_party)}
            value={value.capacity ?? ""}
            onChange={(event) => update({ capacity: event.target.value ? Number(event.target.value) : null })}
          />
          <p className="text-xs text-text-muted">{copy.scheduleSeatsHint}</p>
        </div>
        {value.mode === "shared" ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-min`}>{copy.scheduleMinGroup}</Label>
              <Input
                id={`${id}-min`}
                type="number"
                min={1}
                max={60}
                value={value.min_group}
                onChange={(event) => update({ min_group: Number(event.target.value) || 1 })}
              />
              <p className="text-xs text-text-muted">{copy.scheduleMinGroupHint}</p>
            </div>
            {value.min_group > 1 ? (
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-deadline`}>{copy.scheduleDeadline}</Label>
                <Input
                  id={`${id}-deadline`}
                  type="number"
                  min={1}
                  max={168}
                  value={value.min_group_deadline_hours}
                  onChange={(event) => update({ min_group_deadline_hours: Number(event.target.value) || 24 })}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.scheduleSave}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {copy.scheduleCancel}
        </Button>
      </div>
    </form>
  );
}

/** The schedules of one tour: what exists, and a form to add or change one. */
export function TourSchedules({ tour, onChanged }: { tour: GuideTour; onChanged?: () => void }) {
  const copy = useGuideScheduleCopy();
  const [rows, setRows] = React.useState<TourSchedule[] | null>(tour.schedules ?? null);
  const [editing, setEditing] = React.useState<ScheduleInput | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const loaded = await fetchSchedules(tour.id);
      setRows(Array.isArray(loaded) ? loaded : []);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    }
  }, [tour.id]);

  // First load, only when the tour did not arrive with its schedules.
  const needsLoad = tour.schedules === undefined;
  React.useEffect(() => {
    if (!needsLoad) {
      return;
    }
    let cancelled = false;
    fetchSchedules(tour.id)
      .then((loaded) => {
        if (!cancelled) {
          setRows(Array.isArray(loaded) ? loaded : []);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : String(caught));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [needsLoad, tour.id]);

  async function onStop(schedule: TourSchedule) {
    setBusy(schedule.id);
    setError(null);
    try {
      const result = await deleteSchedule(schedule.id);
      setNotice(
        interpolate(copy.scheduleDeleted, { cleared: String(result.cleared), kept: String(result.kept_booked) }),
      );
      await reload();
      onChanged?.();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label={`${copy.schedulesTitle}: ${tour.title}`} className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarClock className="size-4 text-brand" aria-hidden />
          {tour.title}
        </h3>
        {editing ? null : (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(blankSchedule())}>
            <Plus aria-hidden />
            {copy.scheduleAdd}
          </Button>
        )}
      </div>
      {notice ? (
        <Notice tone="success" role="status">
          {notice}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {rows === null ? (
        <Loader2 className="size-5 animate-spin text-text-muted" aria-hidden />
      ) : rows.length === 0 && !editing ? (
        <p className="text-sm text-text-muted">{copy.schedulesEmpty}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((schedule) => (
            <li
              key={schedule.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-control border border-border-subtle bg-surface px-3 py-2.5"
            >
              <Summary schedule={schedule} />
              <span className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(scheduleInput(schedule))}
                  aria-label={`${copy.scheduleEdit}: ${schedule.start_times.join(", ")}`}
                >
                  <Pencil aria-hidden />
                  {copy.scheduleEdit}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => void onStop(schedule)}
                  aria-label={`${copy.scheduleDelete}: ${schedule.start_times.join(", ")}`}
                >
                  {busy === schedule.id ? <Loader2 className="animate-spin" aria-hidden /> : <Square aria-hidden />}
                  {copy.scheduleDelete}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <ScheduleForm
          key={editing.id ?? "new"}
          tour={tour}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSaved={(created) => {
            setEditing(null);
            setNotice(interpolate(copy.scheduleSaved, { n: String(created), created: String(created) }));
            void reload();
            onChanged?.();
          }}
        />
      ) : null}
      <p className="flex items-center gap-1.5 text-xs text-text-muted">
        <Users className="size-3.5" aria-hidden />
        {copy.schedulesBody}
      </p>
    </section>
  );
}
