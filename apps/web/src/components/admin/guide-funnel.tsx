"use client";

import * as React from "react";
import { Filter, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { interpolate } from "@/i18n/catalogues";
import { useGuideTrustCopy, type GuideTrustCopy } from "@/lib/guide-trust-copy";
import { fetchGuideFunnel, type GuideFunnel } from "@/lib/guides";

const PERIODS = [7, 30, 90, 365] as const;

/** Percentage of the previous step, or null when the previous step is empty. */
export function stepRate(current: number, previous: number): number | null {
  return previous > 0 ? Math.round((current / previous) * 100) : null;
}

type Step = { label: string; value: number };

function StepRow({ title, steps, copy }: { title: string; steps: Step[]; copy: GuideTrustCopy }) {
  return (
    <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5" aria-label={title}>
      <h2 className="font-semibold">{title}</h2>
      <ol className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {steps.map((step, index) => {
          const rate = index > 0 ? stepRate(step.value, steps[index - 1]?.value ?? 0) : null;
          return (
            <li key={step.label} className="grid gap-0.5">
              <span className="text-sm text-text-muted">{step.label}</span>
              <span className="text-2xl font-semibold tabular-nums">{step.value}</span>
              {rate !== null ? (
                <span className="text-xs text-text-muted">{interpolate(copy.funnelRate, { rate: String(rate) })}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** /admin/guide-funnel: where guides and travellers drop off, step by step. */
export function GuideFunnelView() {
  const copy = useGuideTrustCopy();
  const [days, setDays] = React.useState<number>(30);
  const [funnel, setFunnel] = React.useState<GuideFunnel | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetchGuideFunnel(days)
      .then((next) => {
        if (!cancelled) {
          setFunnel(next);
          setFailed(false);
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
  }, [days]);

  return (
    <div className="grid gap-6">
      <PageHeader
        icon={<Filter aria-hidden />}
        title={copy.funnelTitle}
        description={copy.funnelBody}
        actions={
          <div className="grid gap-1.5">
            <Label htmlFor="funnel-period">{copy.funnelPeriod}</Label>
            <NativeSelect
              id="funnel-period"
              value={String(days)}
              onChange={(event) => {
                setFunnel(null);
                setDays(Number(event.target.value));
              }}
            >
              {PERIODS.map((value) => (
                <option key={value} value={value}>
                  {interpolate(copy.funnelDays, { n: String(value) })}
                </option>
              ))}
            </NativeSelect>
          </div>
        }
      />
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : !funnel ? (
        <div className="grid place-items-center py-16 text-text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : (
        <>
          <StepRow
            title={copy.funnelApplications}
            copy={copy}
            steps={[
              { label: copy.funnelStarted, value: funnel.applications.started },
              { label: copy.funnelSubmitted, value: funnel.applications.submitted },
              { label: copy.funnelApproved, value: funnel.applications.approved },
            ]}
          />
          <p className="-mt-3 text-sm text-text-muted">
            {copy.funnelWaiting}: {funnel.applications.waiting} · {copy.funnelRejected}: {funnel.applications.rejected}
          </p>
          <StepRow
            title={copy.funnelGuides}
            copy={copy}
            steps={[
              { label: copy.funnelApproved, value: funnel.guides.approved },
              { label: copy.funnelWithTour, value: funnel.guides.with_published_tour },
            ]}
          />
          <p className="-mt-3 text-sm text-text-muted">
            {copy.funnelLicensed}: {funnel.guides.licensed} · {copy.funnelHosts}: {funnel.guides.hosts} ·{" "}
            {copy.funnelHireable}: {funnel.guides.hireable} · {copy.funnelTours}: {funnel.tours.published}
          </p>
          <StepRow
            title={copy.funnelRequests}
            copy={copy}
            steps={[
              { label: copy.funnelAsked, value: funnel.tour_requests.received },
              { label: copy.funnelConfirmed, value: funnel.tour_requests.confirmed },
              { label: copy.funnelCompleted, value: funnel.tour_requests.completed },
            ]}
          />
          <StepRow
            title={copy.funnelEngagements}
            copy={copy}
            steps={[
              { label: copy.funnelAsked, value: funnel.engagements.requested },
              { label: copy.funnelConfirmed, value: funnel.engagements.confirmed },
              { label: copy.funnelCompleted, value: funnel.engagements.completed },
            ]}
          />
          {funnel.engagements.median_response_hours !== null ? (
            <p className="-mt-3 text-sm text-text-muted">
              {interpolate(copy.funnelResponse, { hours: String(funnel.engagements.median_response_hours) })}
            </p>
          ) : null}
          <StepRow
            title={copy.funnelProposals}
            copy={copy}
            steps={[
              { label: copy.funnelSubmitted, value: funnel.proposals.submitted },
              { label: copy.funnelAccepted, value: funnel.proposals.accepted },
            ]}
          />
          <dl className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-text-muted">{copy.funnelDaysCompleted}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{funnel.days_completed}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">{copy.funnelReviews}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{funnel.reviews.written}</dd>
              {funnel.reviews.of_guides_average !== null ? (
                <dd className="text-xs text-text-muted">
                  {interpolate(copy.funnelAverage, { avg: String(funnel.reviews.of_guides_average) })}
                </dd>
              ) : null}
            </div>
            <div>
              <dt className="text-sm text-text-muted">{copy.funnelReports}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{funnel.reports.open}</dd>
            </div>
            <div>
              <dt className="text-sm text-text-muted">{copy.funnelSafety}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{funnel.reports.safety}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}
