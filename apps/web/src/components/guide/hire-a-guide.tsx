"use client";

import * as React from "react";
import { BadgeCheck, Globe, Loader2, MapPin, Phone, Send, UserRound, Users } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { ProposalDiff } from "@/components/guide/proposal-diff";
import { ListSearch, useDisplayNames } from "@/components/guide/pickers";
import { ReportProblem } from "@/components/guide/report-problem";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideHireCopy, type GuideHireCopy } from "@/lib/guide-hire-copy";
import {
  cancelEngagement,
  decideEngagement,
  fetchTripEngagements,
  matchGuides,
  requestEngagement,
  type Engagement,
  type EngagementState,
  type MatchedGuide,
} from "@/lib/guide-hire";
import { COMMON_LANGUAGES, languageName, matchesQuery } from "@/lib/place-search";
import { fetchTripVersions } from "@/lib/planner";
import { useSearchCopy } from "@/lib/search-copy";

const LANGUAGES = COMMON_LANGUAGES;

export function engagementStateLabel(state: EngagementState, copy: GuideHireCopy): string {
  return {
    requested: copy.hireStateRequested,
    accepted: copy.hireStateAccepted,
    declined: copy.hireStateDeclined,
    changes_proposed: copy.hireStateChanges,
    confirmed: copy.hireStateConfirmed,
    completed: copy.hireStateCompleted,
    cancelled: copy.hireStateCancelled,
  }[state];
}

export function engagementTone(state: EngagementState): "success" | "warning" | "danger" | "secondary" | "outline" {
  if (state === "confirmed" || state === "completed") {
    return "success";
  }
  if (state === "declined" || state === "cancelled") {
    return "outline";
  }
  return "warning";
}

function EngagementCard({ engagement, onChanged }: { engagement: Engagement; onChanged: () => void }) {
  const copy = useGuideHireCopy();
  const { locale } = useLocale();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const amount = formatCurrency(locale, engagement.rate_minor / 100, engagement.currency || "USD");
  const open = ["requested", "accepted", "changes_proposed", "confirmed"].includes(engagement.state);

  async function run(label: string, task: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await task();
      onChanged();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.hireLoadError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="title-card">{engagement.guide.display_name}</span>
            {engagement.guide.badge ? <BadgeCheck className="size-4 text-accent-strong" aria-hidden /> : null}
          </span>
          <span className="text-sm text-text-muted">
            {formatDate(locale, `${engagement.local_date}T12:00:00Z`, { dateStyle: "full" })} ·{" "}
            {interpolate(copy.hireVersion, { n: String(engagement.itinerary.version) })}
          </span>
        </div>
        <Badge variant={engagementTone(engagement.state)}>{engagementStateLabel(engagement.state, copy)}</Badge>
      </div>

      {engagement.state === "changes_proposed" && engagement.proposal ? (
        <ProposalDiff proposal={engagement.proposal} currentRate={engagement.rate_minor} />
      ) : null}
      {engagement.decline_reason && (engagement.state === "declined" || engagement.state === "cancelled") ? (
        <p className="text-sm text-text-muted">{interpolate(copy.hireReason, { reason: engagement.decline_reason })}</p>
      ) : null}
      {engagement.state === "confirmed" ? (
        <div className="grid gap-1 text-sm">
          <p>{interpolate(copy.hirePayOnDay, { amount })}</p>
          <p className="inline-flex items-center gap-1.5 font-medium">
            <Phone className="size-4 text-text-muted" aria-hidden />
            {engagement.contact?.phone
              ? interpolate(copy.hireGuidePhone, { phone: engagement.contact.phone })
              : copy.hireNoPhone}
          </p>
        </div>
      ) : null}
      {engagement.state === "confirmed" || engagement.state === "completed" ? (
        <ReportProblem engagementId={engagement.id} />
      ) : null}
      {engagement.state === "completed" ? (
        <Button asChild variant="outline" className="w-fit">
          <LocaleLink href="/guides/review">{copy.hireReviewGuide}</LocaleLink>
        </Button>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {open ? (
        <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
          {engagement.state === "accepted" ? (
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("confirm", () => decideEngagement(engagement.id, "confirm"))}
            >
              {busy === "confirm" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {copy.hireConfirm}
            </Button>
          ) : null}
          {engagement.state === "changes_proposed" ? (
            <>
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("accept", () => decideEngagement(engagement.id, "accept_changes"))}
              >
                {busy === "accept" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {copy.hireAcceptChanges}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void run("reject", () => decideEngagement(engagement.id, "reject_changes"))}
              >
                {copy.hireRejectChanges}
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null}
            onClick={() => void run("cancel", () => cancelEngagement(engagement.id))}
          >
            {copy.hireCancel}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function AskForm({
  guide,
  versionId,
  onSent,
  onClose,
}: {
  guide: MatchedGuide;
  versionId: string;
  onSent: () => void;
  onClose: () => void;
}) {
  const copy = useGuideHireCopy();
  const [message, setMessage] = React.useState("");
  const [dietary, setDietary] = React.useState("");
  const [accessibility, setAccessibility] = React.useState("");
  const [children, setChildren] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestEngagement({
        version_id: versionId,
        guide_slug: guide.slug,
        message: message.trim(),
        party_notes: { dietary: dietary.trim(), accessibility: accessibility.trim(), children: children.trim() },
        contact_phone: phone.trim(),
      });
      onSent();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.hireLoadError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="grid gap-3 border-t border-border-subtle pt-4"
      aria-label={interpolate(copy.hireAsk, { name: guide.display_name })}
    >
      <div className="grid gap-1.5">
        <Label htmlFor={`msg-${guide.slug}`}>{copy.hireMessage}</Label>
        <Textarea id={`msg-${guide.slug}`} rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`diet-${guide.slug}`}>{copy.hireDietary}</Label>
          <Input id={`diet-${guide.slug}`} value={dietary} onChange={(e) => setDietary(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`access-${guide.slug}`}>{copy.hireAccessibility}</Label>
          <Input id={`access-${guide.slug}`} value={accessibility} onChange={(e) => setAccessibility(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`kids-${guide.slug}`}>{copy.hireChildren}</Label>
          <Input id={`kids-${guide.slug}`} value={children} onChange={(e) => setChildren(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor={`phone-${guide.slug}`}>{copy.hirePhone}</Label>
        <Input
          id={`phone-${guide.slug}`}
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {pending ? copy.hireAsking : copy.hireSend}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {copy.hireClose}
        </Button>
      </div>
    </form>
  );
}

function GuideMatch({ guide, versionId, onSent }: { guide: MatchedGuide; versionId: string; onSent: () => void }) {
  const copy = useGuideHireCopy();
  const { locale } = useLocale();
  const [asking, setAsking] = React.useState(false);
  const names = useDisplayNames();

  return (
    <li className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <LocaleLink href={`/guides/${guide.slug}`} className="title-card hover:underline">
            {guide.display_name}
          </LocaleLink>
          {guide.headline ? <span className="text-sm text-text-muted">{guide.headline}</span> : null}
        </div>
        <span className="font-semibold">
          {interpolate(copy.hireRate, {
            amount: formatCurrency(locale, (guide.day_rate_minor ?? 0) / 100, "USD"),
          })}
        </span>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {guide.matched_regions.length ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden />
            {interpolate(copy.hireCovers, { regions: guide.matched_regions.map(names.region).join(", ") })}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1">
          <Globe className="size-3" aria-hidden />
          {guide.languages.map(names.language).join(", ")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="size-3" aria-hidden />
          {interpolate(copy.hireGroup, { n: String(guide.max_group) })}
        </span>
      </p>
      {asking ? (
        <AskForm
          guide={guide}
          versionId={versionId}
          onSent={() => {
            setAsking(false);
            onSent();
          }}
          onClose={() => setAsking(false)}
        />
      ) : (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setAsking(true)}>
          <UserRound aria-hidden />
          {interpolate(copy.hireAsk, { name: guide.display_name })}
        </Button>
      )}
    </li>
  );
}

/** /plan/[id]/guide: find a licensed guide for the latest version of a plan, and follow the ask. */
export function HireAGuide({ tripId }: { tripId: string }) {
  const copy = useGuideHireCopy();
  const [versionId, setVersionId] = React.useState<string | null | undefined>(undefined);
  const [engagements, setEngagements] = React.useState<Engagement[]>([]);
  const [matches, setMatches] = React.useState<MatchedGuide[] | null>(null);
  const [language, setLanguage] = React.useState("");
  const [query, setQuery] = React.useState("");
  const search = useSearchCopy();
  const { locale } = useLocale();
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchTripVersions(tripId), fetchTripEngagements(tripId)])
      .then(([versions, rows]) => {
        if (cancelled) {
          return;
        }
        const latest = [...versions].sort((a, b) => b.version - a.version)[0];
        setVersionId(latest?.version_id ?? null);
        setEngagements(rows);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, version]);

  React.useEffect(() => {
    if (!versionId) {
      return;
    }
    let cancelled = false;
    void matchGuides(versionId, { language: language || undefined })
      .then((rows) => {
        if (!cancelled) {
          setMatches(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [versionId, language, version]);

  const refresh = () => setVersion((value) => value + 1);
  const asked = new Set(
    engagements
      .filter((row) => ["requested", "accepted", "changes_proposed", "confirmed"].includes(row.state))
      .map((row) => row.guide.slug),
  );

  const open = (matches ?? []).filter((row) => !asked.has(row.slug));
  const shownMatches = open.filter((row) => matchesQuery(query, row.display_name, row.headline));

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.hireLoadError}
      </Notice>
    );
  }
  if (versionId === undefined) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (versionId === null) {
    return (
      <EmptyState
        icon={<UserRound aria-hidden />}
        title={copy.hireNoPlan}
        action={
          <Button asChild>
            <LocaleLink href={`/plan?trip=${tripId}`}>{copy.hireOpenPlanner}</LocaleLink>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.hireKicker}
        icon={<UserRound aria-hidden />}
        title={copy.hireTitle}
        description={copy.hireBody}
        actions={
          <Button asChild variant="outline">
            <LocaleLink href={`/plan?trip=${tripId}`}>{copy.hireOpenPlanner}</LocaleLink>
          </Button>
        }
      />

      {engagements.length ? (
        <section className="grid gap-3" aria-labelledby="hire-requests">
          <h2 id="hire-requests" className="title-section text-[1.2rem]">
            {copy.hireRequests}
          </h2>
          <ul className="grid gap-3">
            {engagements.map((row) => (
              <EngagementCard key={row.id} engagement={row} onChanged={refresh} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="grid gap-4" aria-labelledby="hire-matches">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="hire-matches" className="title-section text-[1.2rem]">
            {copy.hireTitle}
          </h2>
          <div className="grid gap-1.5">
            <Label htmlFor="hire-language">{copy.hireLanguage}</Label>

            <NativeSelect
              id="hire-language"
              wrapperClassName="w-44"
              value={language}
              onChange={(event) => {
                setMatches(null);
                setLanguage(event.target.value);
              }}
            >
              <option value="">{copy.hireAnyLanguage}</option>
              {LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {languageName(code, locale)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {open.length > 3 ? (
          <ListSearch
            value={query}
            onChange={setQuery}
            placeholder={search.guideSearch}
            shown={shownMatches.length}
            total={open.length}
          />
        ) : null}
        {matches === null ? (
          <div className="grid place-items-center py-10 text-text-muted">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </div>
        ) : open.length === 0 ? (
          <Notice role="status">{copy.hireEmpty}</Notice>
        ) : shownMatches.length === 0 ? (
          <p className="text-sm text-text-muted">{search.noResults}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {shownMatches.map((row) => (
              <GuideMatch key={row.slug} guide={row} versionId={versionId} onSent={refresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
