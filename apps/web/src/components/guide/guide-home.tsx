"use client";

import * as React from "react";
import { CalendarDays, Clock, Inbox, Loader2, Route, Users } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { GuideApplication } from "@/components/guide/guide-application";
import { useGuide } from "@/components/guide/guide-provider";
import { HireTerms } from "@/components/guide/hire-terms";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { useGuideWorkCopy } from "@/lib/guide-work-copy";
import { fetchGuideRequests, fetchMyTours, type GuideRequest, type GuideTour } from "@/lib/guide-work";

type Summary = { pending: GuideRequest[]; confirmed: GuideRequest[]; tours: GuideTour[] };

export function summarise(requests: GuideRequest[], tours: GuideTour[], now = new Date()): Summary {
  const future = (row: GuideRequest) => new Date(row.starts_at).getTime() >= now.getTime();
  const byStart = (a: GuideRequest, b: GuideRequest) => a.starts_at.localeCompare(b.starts_at);
  return {
    pending: requests.filter((row) => row.status === "pending" && future(row)).sort(byStart),
    confirmed: requests.filter((row) => row.status === "confirmed" && future(row)).sort(byStart),
    tours: tours.filter((tour) => tour.status === "published"),
  };
}

function Stat({ label, value, href, icon }: { label: string; value: number; href: string; icon: React.ReactNode }) {
  return (
    <LocaleLink
      href={href}
      className="grid gap-1 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="flex items-center gap-2 text-sm text-text-muted [&_svg]:size-4">
        {icon}
        {label}
      </span>
      <span className="text-3xl font-semibold tabular-nums">{value}</span>
    </LocaleLink>
  );
}

function Dashboard() {
  const copy = useGuideWorkCopy();
  const { locale } = useLocale();
  const [summary, setSummary] = React.useState<Summary | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchGuideRequests(), fetchMyTours()])
      .then(([requests, tours]) => {
        if (!cancelled) {
          setSummary(summarise(requests, tours));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSummary({ pending: [], confirmed: [], tours: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="grid gap-6" aria-labelledby="guide-home-title">
      <PageHeader
        id="guide-home-title"
        eyebrow={copy.portalKicker}
        title={copy.homeTitle}
        description={copy.homeBody}
        actions={
          <>
            <Button asChild variant="outline">
              <LocaleLink href="/guide/calendar">{copy.homeGoCalendar}</LocaleLink>
            </Button>
            <Button asChild>
              <LocaleLink href="/guide/tours">{copy.homeGoTours}</LocaleLink>
            </Button>
          </>
        }
      />
      {summary === null ? (
        <div className="grid place-items-center py-10 text-text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label={copy.homePending} value={summary.pending.length} href="/guide/requests" icon={<Inbox />} />
            <Stat
              label={copy.homeUpcoming}
              value={summary.confirmed.length}
              href="/guide/requests"
              icon={<CalendarDays />}
            />
            <Stat label={copy.homeTours} value={summary.tours.length} href="/guide/tours" icon={<Route />} />
          </div>
          <div className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
            <h2 className="title-section text-[1.15rem]">{copy.homeNextTitle}</h2>
            {summary.confirmed.length ? (
              <ol className="divide-y divide-border-subtle">
                {summary.confirmed.slice(0, 6).map((row) => (
                  <li key={row.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[16rem_1fr_auto] sm:items-center">
                    <span className="inline-flex items-center gap-1.5 font-medium tabular-nums">
                      <Clock className="size-3.5 text-text-muted" aria-hidden />
                      {formatDate(locale, row.starts_at, { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    <span>{row.experience_title}</span>
                    <span className="inline-flex items-center gap-1 text-text-muted">
                      <Users className="size-3.5" aria-hidden />
                      {interpolate(copy.requestParty, { n: String(row.party_size) })}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-text-muted">{copy.homeNothingNext}</p>
            )}
            {summary.pending.length ? (
              <Button asChild className="w-fit">
                <LocaleLink href="/guide/requests">{copy.homeGoRequests}</LocaleLink>
              </Button>
            ) : null}
          </div>
        </>
      )}
      <HireTerms />
      <h2 className="title-section pt-4 text-[1.15rem]">{copy.homeYourPage}</h2>
    </section>
  );
}

/**
 * /guide: an applicant sees their application; an approved guide sees their days
 * first and their page and documents underneath.
 */
export function GuideHome() {
  const { profile, loading } = useGuide();
  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  return (
    <div className="grid gap-10">
      {profile?.status === "approved" && profile.organization_id ? <Dashboard /> : null}
      <GuideApplication />
    </div>
  );
}
