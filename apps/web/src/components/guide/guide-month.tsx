"use client";

import * as React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import {
  beirutDay,
  fetchGuideMonth,
  monthEnd,
  shiftMonth,
  summariseDays,
  type DayState,
  type DaySummary,
  type GuideMonth,
} from "@/lib/guide-workspace";
import { useGuideWorkspaceCopy, type GuideWorkspaceKey } from "@/lib/guide-workspace-copy";
import { monthCells } from "@/lib/tour-booking";
import { cn, focusRing } from "@/lib/utils";

const BEIRUT = "Asia/Beirut";

/** Colour and word for each kind of day. The word is always said too, never colour alone. */
const STATES: { state: Exclude<DayState, "empty">; key: GuideWorkspaceKey; className: string }[] = [
  { state: "open", key: "legendOpen", className: "bg-success-subtle border-success/40" },
  { state: "partly", key: "legendPartly", className: "bg-warning-subtle border-warning/50" },
  { state: "full", key: "legendFull", className: "bg-brand text-brand-foreground border-brand" },
  { state: "private", key: "legendPrivate", className: "bg-accent-subtle border-accent/50" },
  { state: "hired", key: "legendHired", className: "bg-accent text-accent-foreground border-accent" },
  { state: "blocked", key: "legendBlocked", className: "bg-surface-sunken border-border-strong" },
  { state: "off", key: "legendOff", className: "bg-surface-sunken text-text-muted border-dashed border-border-strong" },
];

const STATE_BY_NAME = new Map(STATES.map((item) => [item.state, item]));

/** The guide's month: every run, booking, busy time, hired day and day off. */
export function GuideMonthView() {
  const copy = useGuideWorkspaceCopy();
  const { locale } = useLocale();
  const [month, setMonth] = React.useState(() => `${beirutDay(Date.now()).slice(0, 7)}-01`);
  const [loaded, setLoaded] = React.useState<{ month: string; value: GuideMonth | null } | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchGuideMonth(month, monthEnd(month))
      .then((value) => {
        if (!cancelled) setLoaded({ month, value });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ month, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const current = loaded?.month === month ? loaded : null;
  const days = React.useMemo(
    () => (current?.value ? summariseDays(current.value) : new Map<string, DaySummary>()),
    [current],
  );
  const weekdayLabels = React.useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        formatDate(locale, `2024-01-0${index + 1}T12:00:00Z`, { dateStyle: undefined, weekday: "short" }),
      ),
    [locale],
  );
  const selectedDay = selected ? days.get(selected) : undefined;

  const move = (delta: number) => {
    setMonth(shiftMonth(month, delta));
    setSelected(null);
  };

  return (
    <section
      aria-labelledby="month-title"
      className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="month-title" className="title-section flex items-center gap-2 text-[1.15rem]">
            <CalendarDays className="size-4 text-text-muted" aria-hidden />
            {copy.monthTitle}
          </h2>
          <p className="text-sm text-text-muted">{copy.monthBody}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" aria-label={copy.prevMonth} onClick={() => move(-1)}>
            <ChevronLeft className="rtl:rotate-180" aria-hidden />
          </Button>
          <span className="min-w-36 text-center font-semibold" aria-live="polite">
            {formatDate(locale, `${month.slice(0, 7)}-15T12:00:00Z`, {
              dateStyle: undefined,
              month: "long",
              year: "numeric",
            })}
          </span>
          <Button type="button" size="sm" variant="ghost" aria-label={copy.nextMonth} onClick={() => move(1)}>
            <ChevronRight className="rtl:rotate-180" aria-hidden />
          </Button>
        </div>
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-text-muted">
        {STATES.map((item) => (
          <li key={item.state} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-sm border", item.className)} aria-hidden />
            {copy[item.key]}
          </li>
        ))}
      </ul>

      {current === null ? (
        <Loader2 className="mx-auto size-5 animate-spin text-text-muted" aria-hidden />
      ) : current.value === null ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted" aria-hidden>
            {weekdayLabels.map((label, index) => (
              <span key={index}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1" role="group" aria-label={copy.monthTitle}>
            {monthCells(month.slice(0, 7)).map((cell, index) => {
              if (!cell) {
                return <span key={`blank-${index}`} />;
              }
              const entry = days.get(cell);
              const look = entry && entry.state !== "empty" ? STATE_BY_NAME.get(entry.state) : undefined;
              const bookings = entry?.slots.reduce((sum, slot) => sum + slot.bookings.length, 0) ?? 0;
              const label = formatDate(locale, `${cell}T12:00:00Z`, { dateStyle: "full" });
              return (
                <button
                  key={cell}
                  type="button"
                  aria-pressed={selected === cell}
                  aria-label={look ? `${label}, ${copy[look.key]}` : label}
                  onClick={() => setSelected(cell)}
                  className={cn(
                    "grid min-h-14 content-center justify-items-center gap-0.5 rounded-control border text-sm tabular-nums transition-colors",
                    look ? look.className : "border-border-subtle bg-surface",
                    selected === cell && "ring-2 ring-brand ring-offset-1 ring-offset-surface-raised",
                    focusRing,
                  )}
                >
                  <span className="font-medium">{Number(cell.slice(8))}</span>
                  {bookings ? (
                    <span className="text-[0.7rem] leading-none opacity-80" aria-hidden>
                      {bookings}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {selected ? <DayDetail date={selected} entry={selectedDay} /> : null}
        </>
      )}
    </section>
  );
}

function DayDetail({ date, entry }: { date: string; entry: DaySummary | undefined }) {
  const copy = useGuideWorkspaceCopy();
  const { locale } = useLocale();
  const time = (iso: string) =>
    formatDate(locale, iso, { dateStyle: undefined, hour: "2-digit", minute: "2-digit", timeZone: BEIRUT });
  const empty = !entry || (!entry.slots.length && !entry.blocks.length && !entry.hired.length && !entry.off.length);

  return (
    <div className="grid gap-3 border-t border-border-subtle pt-4" aria-live="polite">
      <h3 className="font-semibold">{formatDate(locale, `${date}T12:00:00Z`, { dateStyle: "full" })}</h3>
      {empty ? <p className="text-sm text-text-muted">{copy.dayEmpty}</p> : null}
      <ul className="grid gap-2">
        {entry?.hired.map((hired) => (
          <li key={hired.id}>
            <LocaleLink
              href={`/guide/requests/${hired.id}`}
              className={cn("font-medium text-accent-strong underline-offset-2 hover:underline", focusRing)}
            >
              {copy.hiredDay}
            </LocaleLink>
          </li>
        ))}
        {entry?.off.map((off) => (
          <li key={off.local_date} className="text-sm">
            {copy.dayOff}
            {off.reason ? <span className="text-text-muted"> · {off.reason}</span> : null}
          </li>
        ))}
        {entry?.slots.map((slot) => (
          <li key={slot.id} className="grid gap-1.5 rounded-control border border-border-subtle bg-surface px-3 py-2">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium tabular-nums">
                {time(slot.starts_at)} – {time(slot.ends_at)}
              </span>
              <span>{slot.tour_title}</span>
              {slot.private ? <Badge variant="outline">{copy.runPrivate}</Badge> : null}
              {slot.closed ? <Badge variant="outline">{copy.runClosed}</Badge> : null}
              <span className="text-sm text-text-muted">
                {interpolate(copy.runSeats, { reserved: String(slot.reserved), capacity: String(slot.capacity) })}
              </span>
            </span>
            {slot.bookings.length ? (
              <ul className="flex flex-wrap gap-2">
                {slot.bookings.map((booking) => (
                  <li key={booking.id}>
                    <LocaleLink
                      href={`/guide/bookings/${booking.id}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-2.5 py-1 text-xs hover:border-brand",
                        focusRing,
                      )}
                    >
                      <span className="font-mono">{booking.code ?? "—"}</span>
                      <span>{interpolate(copy.guestsN, { n: String(booking.party_size) })}</span>
                      {booking.status === "pending" ? (
                        <span className="text-warning">{copy.requestPending}</span>
                      ) : null}
                      {booking.checked_in ? <span className="text-success">{copy.checkedIn}</span> : null}
                      {booking.no_show ? <span className="text-danger">{copy.noShow}</span> : null}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
        {entry?.blocks.map((block) => (
          <li key={`${block.id}-${date}`} className="text-sm">
            <span className="font-medium tabular-nums">
              {time(block.starts_at)} – {time(block.ends_at)}
            </span>{" "}
            {block.kind === "external" ? copy.blockExternal : copy.blockManual}
            {block.note ? <span className="text-text-muted"> · {block.note}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
