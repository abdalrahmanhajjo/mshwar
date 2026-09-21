"use client";

import * as React from "react";
import {
  AlertTriangle,
  Car,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MapPin,
  Scissors,
  Shuffle,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { previewManualPlan, type DayIssue, type ManualPreview, type ManualStopTiming } from "@/lib/planner";
import type { PlannerCopy } from "@/lib/planner-copy";
import type { Experience } from "@/lib/catalog";
import { interpolate } from "@/i18n/catalogues";
import { cn } from "@/lib/utils";

/** Matches the server's LONG_WAIT_MINUTES: below this a wait is not worth a badge. */
const LONG_WAIT_MINUTES = 45;
/** Long enough that a burst of clicks makes one request, short enough to feel live. */
const DEBOUNCE_MS = 400;

const km = (metres: number) => Math.round(metres / 100) / 10;

export type DayCheckInput = {
  slugs: string[];
  destinationSlugs: string[];
  partySize: number;
  windowStart: string;
  budgetMinor: number;
  strictBudget: boolean;
  locale: string;
};

/** Debounced live feasibility for the picks currently in the builder. */
export function useDayCheck(input: DayCheckInput) {
  const [preview, setPreview] = React.useState<ManualPreview | null>(null);
  const [checking, setChecking] = React.useState(false);
  // Serialised so the effect re-runs on value, not on a fresh object each render.
  const key = JSON.stringify(input);

  React.useEffect(() => {
    const parsed = JSON.parse(key) as DayCheckInput;
    const controller = new AbortController();
    if (!parsed.slugs.length) {
      return () => controller.abort();
    }
    const timer = setTimeout(() => {
      setChecking(true);
      void previewManualPlan(
        {
          experience_slugs: parsed.slugs,
          destination_slugs: parsed.destinationSlugs,
          party_size: parsed.partySize,
          window_start: parsed.windowStart,
          budget_minor: parsed.budgetMinor,
          strict_budget: parsed.strictBudget,
          currency: "USD",
          locale: parsed.locale,
        },
        controller.signal,
      )
        .then((result) => {
          if (!controller.signal.aborted) {
            setPreview(result);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setPreview(null);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setChecking(false);
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key]);

  // With nothing picked there is nothing to report, and the last answer is stale.
  const empty = !(JSON.parse(key) as DayCheckInput).slugs.length;
  return { preview: empty ? null : preview, checking: !empty && checking };
}

/** Turn a structured issue into a sentence, so the rule and its wording stay separate. */
export function issueMessage(issue: DayIssue, copy: PlannerCopy): string {
  const [first = "", second = ""] = issue.labels;
  const detail = issue.detail ?? {};
  switch (issue.code) {
    case "region_spread":
      return interpolate(copy.issueRegionSpread, { a: first, b: second, km: km(Number(detail.distance_m ?? 0)) });
    case "long_transfer":
      return interpolate(copy.issueLongTransfer, { a: first, n: Number(detail.minutes ?? 0) });
    case "travel_heavy":
      return interpolate(copy.issueTravelHeavy, {
        n: Number(detail.travel_minutes ?? 0),
        total: Number(detail.day_minutes ?? 0),
      });
    case "day_overflow":
      return interpolate(copy.issueDayOverflow, { a: first, n: Number(detail.over_by_minutes ?? 0) });
    case "closed_that_day":
      return interpolate(copy.issueClosedThatDay, { a: issue.labels.join(", ") });
    case "after_hours":
      return interpolate(copy.issueAfterHours, { a: issue.labels.join(", ") });
    case "long_wait":
      return interpolate(copy.issueLongWait, { a: first, n: Number(detail.wait_minutes ?? 0) });
    case "hours_unknown":
      return interpolate(copy.issueHoursUnknown, { a: issue.labels.join(", ") });
    case "route_unavailable":
      return interpolate(copy.issueRouteUnavailable, { a: first });
    default:
      return issue.code;
  }
}

const TONE = { blocking: "danger", warning: "warning", info: "info" } as const;

function StopRow({
  pick,
  timing,
  index,
  total,
  copy,
  formatTime,
  onMove,
  onRemove,
}: {
  pick: Experience;
  timing: ManualStopTiming | undefined;
  index: number;
  total: number;
  copy: PlannerCopy;
  formatTime: (iso: string) => string;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (pick: Experience) => void;
}) {
  const closed = timing?.flags.includes("closed_that_day") ?? false;
  return (
    <li
      className={cn(
        "grid gap-2 rounded-control border bg-surface px-3 py-2.5",
        closed ? "border-danger/50" : "border-border-subtle",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-brand-subtle text-xs font-semibold tabular-nums text-brand">
          {index + 1}
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate font-medium leading-snug">{pick.title}</span>
          <span className="inline-flex min-w-0 items-center gap-1 text-xs text-text-muted">
            <MapPin className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{timing?.destination_name || pick.placeLabel}</span>
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 rounded-full"
            aria-label={`${copy.flowMoveUp}: ${pick.title}`}
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
          >
            <ChevronUp className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 rounded-full"
            aria-label={`${copy.flowMoveDown}: ${pick.title}`}
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
          >
            <ChevronDown className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 rounded-full text-danger"
            aria-label={`${copy.flowRemove}: ${pick.title}`}
            onClick={() => onRemove(pick)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </span>
      </div>
      {timing ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 ps-10 text-xs text-text-muted">
          {timing.travel_minutes ? (
            <span className="inline-flex items-center gap-1">
              <Car className="size-3 shrink-0" aria-hidden />
              {interpolate(copy.stopDriveFrom, { minutes: timing.travel_minutes, km: km(timing.travel_distance_m) })}
            </span>
          ) : null}
          <span className="tabular-nums">{interpolate(copy.stopArrives, { time: formatTime(timing.arrives_at) })}</span>
          <span className={cn(closed && "font-medium text-danger")}>
            {timing.opens && timing.closes
              ? interpolate(copy.stopOpenBetween, { opens: timing.opens, closes: timing.closes })
              : copy.stopHoursUnknown}
          </span>
          {timing.wait_minutes >= LONG_WAIT_MINUTES ? (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="size-3 shrink-0" aria-hidden />
              {interpolate(copy.stopWaits, { n: timing.wait_minutes })}
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * The day as it stands: the stops in order, when the traveller reaches each one,
 * and whether the whole thing holds together.
 *
 * One list rather than a picks list plus a separate verdict, so the two can
 * never disagree about what "stop 3" is.
 */
export function DayPanel({
  picks,
  preview,
  checking,
  copy,
  locale,
  onMove,
  onRemove,
  onReorder,
  onSplit,
  onClear,
}: {
  picks: Experience[];
  preview: ManualPreview | null;
  checking: boolean;
  copy: PlannerCopy;
  locale: string;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (pick: Experience) => void;
  onReorder: (slugs: string[]) => void;
  onSplit: (slugs: string[]) => void;
  onClear: () => void;
}) {
  const formatTime = (value: string) =>
    new Date(value).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const report = preview?.feasibility ?? null;
  const issues = report?.issues ?? [];
  const blocked = issues.some((issue) => issue.severity === "blocking");
  const bySlug = new Map((preview?.stops ?? []).map((stop) => [stop.slug, stop]));
  const last = preview?.stops.at(-1);

  return (
    <section aria-labelledby="day-panel" aria-busy={checking} className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="day-panel" className="title-card flex items-center gap-2 text-[1.05rem]">
          <Clock className="size-4" aria-hidden />
          {copy.dayPanelTitle}
        </h3>
        {picks.length ? (
          <Button type="button" size="sm" variant="ghost" className="text-text-muted" onClick={onClear}>
            {copy.dayClearAll}
          </Button>
        ) : null}
      </div>

      {picks.length ? (
        <ol className="grid gap-2">
          {picks.map((pick, index) => (
            <StopRow
              key={pick.slug}
              pick={pick}
              timing={bySlug.get(pick.slug)}
              index={index}
              total={picks.length}
              copy={copy}
              formatTime={formatTime}
              onMove={onMove}
              onRemove={onRemove}
            />
          ))}
        </ol>
      ) : (
        <Notice role="status">{copy.dayPanelEmpty}</Notice>
      )}

      {picks.length ? (
        <div className="grid gap-3 border-t border-border-subtle pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {report ? (
              <>
                <Badge variant="secondary" className="gap-1.5">
                  <Car className="size-3.5" aria-hidden />
                  {interpolate(copy.dayCheckDriving, {
                    minutes: report.travel_minutes,
                    km: km(report.travel_distance_m),
                  })}
                </Badge>
                {last ? (
                  <Badge variant="outline" className="tabular-nums">
                    {interpolate(copy.dayEndsBy, { time: formatTime(last.leaves_at) })}
                  </Badge>
                ) : null}
              </>
            ) : null}
            {checking ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {copy.dayCheckChecking}
              </span>
            ) : null}
          </div>

          <div aria-live="polite" className="grid gap-2">
            {report && !checking ? (
              issues.length ? (
                <>
                  {issues.map((issue) => (
                    <Notice key={`${issue.code}-${issue.positions.join("-")}`} tone={TONE[issue.severity]}>
                      {issueMessage(issue, copy)}
                    </Notice>
                  ))}
                  {blocked ? <p className="text-sm text-text-muted">{copy.dayCheckBlocked}</p> : null}
                </>
              ) : (
                <Notice tone="success">{copy.dayCheckFits}</Notice>
              )
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {report && report.order_saves_minutes > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => onReorder(report.suggested_order)}>
                <Shuffle className="size-4" aria-hidden />
                {copy.dayReorder}
                <span className="text-text-muted">
                  ({interpolate(copy.dayReorderSaves, { n: report.order_saves_minutes })})
                </span>
              </Button>
            ) : null}
            {preview?.suggested_days.length ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSplit(preview.suggested_days[0] ?? [])}
              >
                <Scissors className="size-4" aria-hidden />
                {interpolate(copy.daySplit, { n: preview.suggested_days.length })}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
