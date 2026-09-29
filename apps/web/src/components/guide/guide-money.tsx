"use client";

import * as React from "react";
import { BarChart3, ChevronLeft, ChevronRight, Download, Loader2, Wallet } from "lucide-react";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import {
  beirutDay,
  earningsCsvUrl,
  fetchEarnings,
  fetchInsights,
  shiftMonth,
  type Earnings,
  type Insights,
} from "@/lib/guide-workspace";
import { useGuideWorkspaceCopy, type GuideWorkspaceKey } from "@/lib/guide-workspace-copy";
import { focusRing } from "@/lib/utils";

/** /guide/earnings: the month's statement. */
export function GuideEarnings() {
  return <ApprovedGuide>{() => <EarningsView />}</ApprovedGuide>;
}

/** /guide/insights: how each tour is doing. */
export function GuideInsights() {
  return <ApprovedGuide>{() => <InsightsView />}</ApprovedGuide>;
}

function EarningsView() {
  const copy = useGuideWorkspaceCopy();
  const { locale } = useLocale();
  const [thisMonth] = React.useState(() => `${beirutDay(Date.now()).slice(0, 7)}-01`);
  const [month, setMonth] = React.useState(thisMonth);
  const [loaded, setLoaded] = React.useState<{ month: string; value: Earnings | null } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchEarnings(month)
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
  const money = (minor: number, currency = "USD") =>
    formatCurrency(locale, minor / 100, currency, { maximumFractionDigits: 2 });
  const statement = current?.value ?? null;

  return (
    <div className="grid gap-6">
      <PageHeader icon={<Wallet aria-hidden />} title={copy.earningsTitle} description={copy.earningsBody} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={copy.prevMonth}
            onClick={() => setMonth(shiftMonth(month, -1))}
          >
            <ChevronLeft className="rtl:rotate-180" aria-hidden />
          </Button>
          <span className="min-w-36 text-center font-semibold" aria-live="polite">
            {formatDate(locale, `${month.slice(0, 7)}-15T12:00:00Z`, {
              dateStyle: undefined,
              month: "long",
              year: "numeric",
            })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={copy.nextMonth}
            disabled={month >= thisMonth}
            onClick={() => setMonth(shiftMonth(month, 1))}
          >
            <ChevronRight className="rtl:rotate-180" aria-hidden />
          </Button>
        </div>
        {statement?.rows.length ? (
          <Button asChild variant="outline" size="sm">
            <a href={earningsCsvUrl(month)} download>
              <Download aria-hidden />
              {copy.downloadCsv}
            </a>
          </Button>
        ) : null}
      </div>

      {current === null ? (
        <Loader2 className="mx-auto size-6 animate-spin text-text-muted" aria-hidden />
      ) : statement === null ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label={copy.expected} value={money(statement.expected_minor, statement.currency)} />
            <StatCard label={copy.received} value={money(statement.recorded_minor, statement.currency)} />
            <StatCard
              label={interpolate(copy.fee, { p: String(statement.fee_percent) })}
              value={money(statement.fee_minor, statement.currency)}
            />
            <StatCard label={copy.yours} value={money(statement.net_minor, statement.currency)} />
          </div>
          <p className="text-sm text-text-muted">{copy.feeNote}</p>
          {statement.upcoming_bookings ? (
            <p className="text-sm">
              {interpolate(copy.upcoming, {
                n: String(statement.upcoming_bookings),
                amount: money(statement.upcoming_minor, statement.currency),
              })}
            </p>
          ) : null}
          {statement.rows.length === 0 ? (
            <p className="rounded-card border border-dashed border-border-subtle p-8 text-center text-text-muted">
              {copy.earningsEmpty}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface-raised">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-start text-text-muted">
                  <tr className="border-b border-border-subtle">
                    <th scope="col" className="px-4 py-2.5 text-start font-medium">
                      {copy.colDate}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start font-medium">
                      {copy.colBooking}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start font-medium">
                      {copy.colTour}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colGuests}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colExpected}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colReceived}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.map((row) => (
                    <tr key={row.booking_id} className="border-b border-border-subtle last:border-0">
                      <td className="px-4 py-2.5 tabular-nums">
                        {formatDate(locale, row.starts_at, {
                          dateStyle: undefined,
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Asia/Beirut",
                        })}
                      </td>
                      <td className="px-4 py-2.5">
                        <LocaleLink
                          href={`/guide/bookings/${row.booking_id}`}
                          className={`font-mono underline-offset-2 hover:underline ${focusRing}`}
                        >
                          {row.code}
                        </LocaleLink>
                        {row.no_show ? <span className="ms-2 text-xs text-danger">{copy.noShow}</span> : null}
                      </td>
                      <td className="px-4 py-2.5">{row.tour_title}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{row.party_size}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">
                        {money(row.expected_minor, statement.currency)}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums">
                        {row.paid_minor === null ? (
                          <span className="text-text-muted">{copy.notRecorded}</span>
                        ) : (
                          <>
                            {money(row.paid_minor, statement.currency)}
                            {row.paid_method ? (
                              <span className="block text-xs text-text-muted">
                                {copy[`method${row.paid_method}` as GuideWorkspaceKey]}
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const PERIODS = [
  { days: 30, key: "days30" },
  { days: 90, key: "days90" },
  { days: 365, key: "days365" },
] as const;

function InsightsView() {
  const copy = useGuideWorkspaceCopy();
  const [days, setDays] = React.useState(90);
  const [loaded, setLoaded] = React.useState<{ days: number; value: Insights | null } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchInsights(days)
      .then((value) => {
        if (!cancelled) setLoaded({ days, value });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ days, value: null });
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const current = loaded?.days === days ? loaded : null;
  const insights = current?.value ?? null;
  const replyTime = (minutes: number | null) =>
    minutes === null
      ? "—"
      : minutes < 90
        ? interpolate(copy.minutes, { n: String(minutes) })
        : interpolate(copy.hours, { n: String(Math.round(minutes / 60)) });

  return (
    <div className="grid gap-6">
      <PageHeader icon={<BarChart3 aria-hidden />} title={copy.insightsTitle} description={copy.insightsBody} />
      <div className="grid max-w-60 gap-1.5">
        <label htmlFor="insights-period" className="text-sm font-medium">
          {copy.period}
        </label>
        <NativeSelect id="insights-period" value={days} onChange={(event) => setDays(Number(event.target.value))}>
          {PERIODS.map((period) => (
            <option key={period.days} value={period.days}>
              {copy[period.key]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {current === null ? (
        <Loader2 className="mx-auto size-6 animate-spin text-text-muted" aria-hidden />
      ) : insights === null ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : (
        <>
          <section className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-5">
            <h2 className="title-section text-[1.15rem]">{copy.replyTitle}</h2>
            <p className="text-sm">
              {insights.response.answered
                ? interpolate(copy.replyStats, {
                    within: String(insights.response.within_24h),
                    answered: String(insights.response.answered),
                    time: replyTime(insights.response.median_minutes),
                  })
                : copy.replyNone}
            </p>
          </section>
          {insights.tours.length === 0 ? (
            <p className="rounded-card border border-dashed border-border-subtle p-8 text-center text-text-muted">
              {copy.insightsEmpty}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border-subtle bg-surface-raised">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="text-text-muted">
                  <tr className="border-b border-border-subtle">
                    <th scope="col" className="px-4 py-2.5 text-start font-medium">
                      {copy.colTour}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colRequests}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colConfirmed}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colDeclined}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colLapsed}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colCancelled}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colGuestsServed}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-end font-medium">
                      {copy.colOccupancy}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {insights.tours.map((tour) => (
                    <tr key={tour.id} className="border-b border-border-subtle last:border-0">
                      <th scope="row" className="px-4 py-2.5 text-start font-medium">
                        {tour.title}
                      </th>
                      <td className="px-4 py-2.5 text-end tabular-nums">{tour.requests}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{tour.confirmed}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{tour.declined}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{tour.lapsed}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">
                        {tour.cancelled_by_guide} / {tour.cancelled_by_traveller}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums">{tour.guests}</td>
                      <td className="px-4 py-2.5 text-end tabular-nums">
                        {tour.occupancy === null ? "—" : `${tour.occupancy}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
