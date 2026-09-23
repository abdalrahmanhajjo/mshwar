"use client";

import * as React from "react";
import { CheckCircle2, Clock, Loader2, MapPin, Phone, Play, Printer, Route, Users, WifiOff } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideDayCopy, type GuideDayCopy } from "@/lib/guide-day-copy";
import {
  completeDay,
  fetchDaySheet,
  recallDaySheet,
  rememberDaySheet,
  startDay,
  type DaySheet as Sheet,
  type RosterEntry,
  type RunState,
} from "@/lib/guide-day";
import { beirutTime } from "@/lib/guide-hire";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { ReportProblem } from "@/components/guide/report-problem";

export function runStateLabel(state: RunState, copy: GuideDayCopy): string {
  return { scheduled: copy.stateScheduled, started: copy.stateStarted, completed: copy.stateCompleted }[state];
}

function mapsLink(lat: number | null, lng: number | null) {
  return lat === null || lng === null ? null : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function RosterRow({ row, copy }: { row: RosterEntry; copy: GuideDayCopy }) {
  const { locale } = useLocale();
  const notes: [string, string | undefined][] = [
    [copy.dietary, row.notes?.dietary],
    [copy.accessibility, row.notes?.accessibility],
    [copy.children, row.notes?.children],
    [copy.note, row.note],
  ];
  const pending = row.status === "pending" || row.status === "requested";
  return (
    <li className="grid gap-2 py-3 break-inside-avoid">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">
          {row.name} · {interpolate(copy.people, { n: String(row.party_size) })}
        </span>
        <span className="text-sm font-medium">
          {row.collect_minor > 0
            ? interpolate(copy.collect, {
                amount: formatCurrency(locale, row.collect_minor / 100, row.currency || "USD"),
              })
            : copy.free}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {row.phone ? (
          <a href={`tel:${row.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 underline">
            <Phone className="size-3.5" aria-hidden />
            {row.phone}
          </a>
        ) : (
          <span className="text-text-muted">{pending ? copy.pending : copy.noPhone}</span>
        )}
        <span className="text-text-muted">
          {row.reputation?.reviews
            ? interpolate(copy.reputation, {
                average: String(row.reputation.average ?? ""),
                n: String(row.reputation.reviews),
              })
            : copy.newTraveller}
        </span>
      </div>
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        {notes
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="flex gap-1.5">
              <dt className="font-medium">{label}:</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      <ReportProblem engagementId={row.engagement_id} bookingId={row.booking_id} />
    </li>
  );
}

/**
 * /guide/day/[id]: everything a guide needs on the day, on one page that prints
 * cleanly and still opens without a signal (the last copy is kept on the device).
 */
export function DaySheet({ dayId }: { dayId: string }) {
  const copy = useGuideDayCopy();
  const { locale } = useLocale();
  const [sheet, setSheet] = React.useState<Sheet | null>(null);
  const [offline, setOffline] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "start" | "complete">(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchDaySheet(dayId)
      .then((next) => {
        if (!cancelled) {
          setSheet(next);
          setOffline(null);
          rememberDaySheet(next);
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        const saved = recallDaySheet(dayId);
        // A real "not yours" or "not found" is not an offline moment.
        if (saved && !(caught instanceof ApiError && caught.status < 500)) {
          setSheet(saved);
          setOffline(saved.generated_at);
        } else {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dayId]);

  async function act(kind: "start" | "complete") {
    setBusy(kind);
    setError(null);
    try {
      const next = await (kind === "start" ? startDay(dayId) : completeDay(dayId));
      setSheet(next);
      rememberDaySheet(next);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setBusy(null);
    }
  }

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.loadError}
      </Notice>
    );
  }
  if (!sheet) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  const meetingMap = mapsLink(sheet.meeting.lat, sheet.meeting.lng);

  return (
    <article className="grid gap-6 print:gap-4 print:text-[11pt]" aria-labelledby="day-title">
      <header className="grid gap-2">
        <span className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          {copy.kicker} · {sheet.kind === "tour" ? copy.kindTour : copy.kindHire}
          <Badge variant={sheet.run.state === "completed" ? "success" : "secondary"} className="print:hidden">
            {runStateLabel(sheet.run.state, copy)}
          </Badge>
        </span>
        <h1 id="day-title" className="title-page text-balance">
          {sheet.title}
        </h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden />
            {formatDate(locale, `${sheet.local_date}T12:00:00Z`, { dateStyle: "full" })} ·{" "}
            {sheet.starts_at ? beirutTime(sheet.starts_at) : ""}
            {sheet.ends_at ? `–${beirutTime(sheet.ends_at)}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            {interpolate(copy.people, { n: String(sheet.people) })}
          </span>
        </p>
      </header>

      {offline ? (
        <Notice tone="warning" role="status" icon={<WifiOff aria-hidden />}>
          {interpolate(copy.offline, { time: beirutTime(offline) })}
        </Notice>
      ) : (
        <p className="text-xs text-text-muted print:hidden">{copy.savedOffline}</p>
      )}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer aria-hidden />
          {copy.print}
        </Button>
        {sheet.run.state === "scheduled" && !offline ? (
          <Button type="button" disabled={busy !== null} onClick={() => void act("start")}>
            {busy === "start" ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
            {copy.start}
          </Button>
        ) : null}
        {sheet.run.state !== "completed" && !offline ? (
          <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => void act("complete")}>
            {busy === "complete" ? <Loader2 className="animate-spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
            {copy.complete}
          </Button>
        ) : null}
      </div>
      {sheet.run.state !== "completed" ? (
        <p className="text-xs text-text-muted print:hidden">{copy.completeHint}</p>
      ) : null}

      <section className="grid gap-1 rounded-card border border-border-subtle p-4 break-inside-avoid">
        <h2 className="flex items-center gap-2 font-semibold">
          <MapPin className="size-4" aria-hidden />
          {copy.meeting}
        </h2>
        <p>{sheet.meeting.name}</p>
        {sheet.meeting.address ? <p className="text-sm text-text-muted">{sheet.meeting.address}</p> : null}
        {meetingMap ? (
          <a href={meetingMap} target="_blank" rel="noopener noreferrer" className="text-sm underline print:hidden">
            {copy.openMap}
          </a>
        ) : null}
        {sheet.meeting.lat !== null ? (
          <p className="hidden text-xs print:block">
            {sheet.meeting.lat}, {sheet.meeting.lng}
          </p>
        ) : null}
      </section>

      {sheet.stops.length ? (
        <section className="grid gap-2 break-inside-avoid">
          <h2 className="flex items-center gap-2 font-semibold">
            <Route className="size-4" aria-hidden />
            {copy.stops}
          </h2>
          <ol className="grid gap-0 border-s-2 border-border-subtle ps-4">
            {sheet.stops.map((stop, index) => {
              const leg = sheet.legs.find((item) => item.position === index + 1);
              return (
                <li key={`${stop.slug}-${stop.position}`} className="grid gap-0.5 py-2">
                  <span className="font-medium">
                    {stop.starts_at ? (
                      <span className="me-2 tabular-nums">
                        {beirutTime(stop.starts_at)}
                        {stop.ends_at ? `–${beirutTime(stop.ends_at)}` : ""}
                      </span>
                    ) : (
                      <span className="me-2 tabular-nums">{stop.position}.</span>
                    )}
                    <LocaleLink href={`/experiences/${stop.slug}`} className="hover:underline print:no-underline">
                      {stop.title}
                    </LocaleLink>
                  </span>
                  {leg && leg.duration_seconds !== null && index < sheet.stops.length - 1 ? (
                    <span className="text-xs text-text-muted">
                      {interpolate(copy.leg, {
                        minutes: String(Math.round(leg.duration_seconds / 60)),
                        km: String(Math.round((leg.distance_m ?? 0) / 100) / 10),
                      })}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="grid gap-1">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="size-4" aria-hidden />
          {copy.group}
        </h2>
        <ul className="divide-y divide-border-subtle">
          {sheet.roster.map((row) => (
            <RosterRow key={row.booking_id ?? row.engagement_id ?? row.traveller_id} row={row} copy={copy} />
          ))}
        </ul>
      </section>

      {sheet.bring ? (
        <section className="grid gap-1 break-inside-avoid">
          <h2 className="font-semibold">{copy.bring}</h2>
          <p className="whitespace-pre-line text-sm">{sheet.bring}</p>
        </section>
      ) : null}
    </article>
  );
}

/** The page body for /guide/day/[id], for approved guides only. */
export function GuideDaySheet({ dayId }: { dayId: string }) {
  return <ApprovedGuide>{() => <DaySheet dayId={dayId} />}</ApprovedGuide>;
}
