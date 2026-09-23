"use client";

import * as React from "react";
import { ArrowLeft, Check, Loader2, Lock, Phone, Plus, Send, Trash2, X } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { engagementStateLabel, engagementTone } from "@/components/guide/hire-a-guide";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { ProposalDiff } from "@/components/guide/proposal-diff";
import { ReportProblem } from "@/components/guide/report-problem";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideHireCopy } from "@/lib/guide-hire-copy";
import {
  answerEngagement,
  beirutTime,
  cancelEngagement,
  fetchEngagement,
  proposeChanges,
  withBeirutTime,
  type Engagement,
  type ProposedStop,
} from "@/lib/guide-hire";

type Row = {
  key: string;
  stop_id?: string;
  slug?: string;
  title: string;
  locked: boolean;
  starts_at: string;
  ends_at: string;
};

/** Build the proposal body from the editor rows, in time order. */
export function rowsToProposal(rows: Row[]): ProposedStop[] {
  return [...rows]
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((row) =>
      row.stop_id
        ? { stop_id: row.stop_id, starts_at: row.starts_at, ends_at: row.ends_at }
        : { slug: row.slug, starts_at: row.starts_at, ends_at: row.ends_at },
    );
}

function ProposalEditor({ engagement, onSent }: { engagement: Engagement; onSent: (next: Engagement) => void }) {
  const copy = useGuideHireCopy();
  const [rows, setRows] = React.useState<Row[]>(() =>
    engagement.itinerary.stops.map((stop) => ({
      key: stop.id,
      stop_id: stop.id,
      title: stop.title,
      locked: stop.locked,
      starts_at: stop.starts_at,
      ends_at: stop.ends_at,
    })),
  );
  const [slug, setSlug] = React.useState("");
  const [note, setNote] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const setTime = (key: string, field: "starts_at" | "ends_at", value: string) =>
    setRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: withBeirutTime(row[field], value) } : row)),
    );

  function addPlace() {
    const last = [...rows].sort((a, b) => a.ends_at.localeCompare(b.ends_at)).at(-1);
    const base = last?.ends_at ?? engagement.itinerary.window_start;
    const starts = new Date(new Date(base).getTime() + 15 * 60_000).toISOString();
    const ends = new Date(new Date(starts).getTime() + 60 * 60_000).toISOString();
    const handle = slug.trim().toLowerCase();
    setRows((prev) => [
      ...prev,
      {
        key: `new-${handle}-${prev.length}`,
        slug: handle,
        title: handle,
        locked: false,
        starts_at: starts,
        ends_at: ends,
      },
    ]);
    setSlug("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onSent(
        await proposeChanges(engagement.id, {
          stops: rowsToProposal(rows),
          note: note.trim(),
          rate_minor: rate ? Math.round(Number(rate) * 100) : null,
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.hireLoadError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
      aria-label={copy.engProposeTitle}
    >
      <div className="grid gap-1">
        <h2 className="title-section text-[1.15rem]">{copy.engProposeTitle}</h2>
        <p className="text-sm text-text-muted">{copy.engProposeHint}</p>
      </div>
      <ol className="grid gap-2">
        {[...rows]
          .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
          .map((row) => (
            <li
              key={row.key}
              className="grid gap-2 rounded-control border border-border-subtle bg-surface p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
            >
              <span className="flex items-center gap-2 font-medium">
                {row.locked ? <Lock className="size-4 text-text-muted" aria-label={copy.engLocked} /> : null}
                {row.title}
              </span>
              <div className="grid gap-1">
                <Label htmlFor={`start-${row.key}`} className="text-xs">
                  {copy.engStart}
                </Label>
                <Input
                  id={`start-${row.key}`}
                  type="time"
                  className="w-32"
                  disabled={row.locked}
                  value={beirutTime(row.starts_at)}
                  onChange={(event) => setTime(row.key, "starts_at", event.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`end-${row.key}`} className="text-xs">
                  {copy.engEnd}
                </Label>
                <Input
                  id={`end-${row.key}`}
                  type="time"
                  className="w-32"
                  disabled={row.locked}
                  value={beirutTime(row.ends_at)}
                  onChange={(event) => setTime(row.key, "ends_at", event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={row.locked}
                aria-label={`${copy.engRemove} ${row.title}`}
                onClick={() => setRows((prev) => prev.filter((item) => item.key !== row.key))}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
      </ol>
      <div className="flex gap-2">
        <Input
          aria-label={copy.engAddPlace}
          placeholder={copy.engAddSlug}
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <Button type="button" variant="outline" disabled={!slug.trim()} onClick={addPlace}>
          <Plus aria-hidden />
          {copy.engAddPlace}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="proposal-note">{copy.engProposalNote}</Label>
          <Textarea id="proposal-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="proposal-rate">{copy.engProposalRate}</Label>
          <Input
            id="proposal-rate"
            type="number"
            min={0}
            value={rate}
            onChange={(event) => setRate(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Button type="submit" className="w-fit" disabled={pending || rows.length === 0}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {copy.engSendProposal}
      </Button>
    </form>
  );
}

function Detail({ engagementId }: { engagementId: string }) {
  const copy = useGuideHireCopy();
  const { locale } = useLocale();
  const [engagement, setEngagement] = React.useState<Engagement | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [proposing, setProposing] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchEngagement(engagementId)
      .then((row) => {
        if (!cancelled) {
          setEngagement(row);
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
  }, [engagementId]);

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.hireLoadError}
      </Notice>
    );
  }
  if (!engagement) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  async function run(label: string, task: () => Promise<Engagement>) {
    setBusy(label);
    setError(null);
    try {
      setEngagement(await task());
      setProposing(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.hireLoadError);
    } finally {
      setBusy(null);
    }
  }

  const notes = engagement.party_notes;
  const noteRows: [string, string | undefined][] = [
    [copy.hireDietary, notes.dietary],
    [copy.hireAccessibility, notes.accessibility],
    [copy.hireChildren, notes.children],
  ];
  const active = ["requested", "accepted", "changes_proposed", "confirmed"].includes(engagement.state);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.engKicker}
        title={engagement.trip_title}
        description={`${formatDate(locale, `${engagement.local_date}T12:00:00Z`, { dateStyle: "full" })} · ${interpolate(
          copy.engFrom,
          { name: engagement.traveller_name },
        )} · ${interpolate(copy.engParty, { n: String(engagement.party_size) })}`}
        actions={
          <Button asChild variant="ghost">
            <LocaleLink href="/guide/requests">
              <ArrowLeft className="rtl:-scale-x-100" aria-hidden />
              {copy.engBack}
            </LocaleLink>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={engagementTone(engagement.state)}>{engagementStateLabel(engagement.state, copy)}</Badge>
        <Badge variant="outline">
          {interpolate(copy.engRate, {
            amount: formatCurrency(locale, engagement.rate_minor / 100, engagement.currency || "USD"),
          })}
        </Badge>
      </div>
      {engagement.contact?.phone ? (
        <p className="inline-flex items-center gap-2 font-medium">
          <Phone className="size-4 text-text-muted" aria-hidden />
          {interpolate(copy.engTravellerPhone, { phone: engagement.contact.phone })}
        </p>
      ) : null}

      <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
        <h2 className="title-section text-[1.15rem]">{copy.engItinerary}</h2>
        <ol className="divide-y divide-border-subtle">
          {engagement.itinerary.stops.map((stop) => (
            <li key={stop.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[8rem_1fr_auto] sm:items-center">
              <span className="font-medium tabular-nums">
                {beirutTime(stop.starts_at)}–{beirutTime(stop.ends_at)}
              </span>
              <LocaleLink href={`/experiences/${stop.slug}`} className="hover:underline">
                {stop.title}
              </LocaleLink>
              {stop.locked ? (
                <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                  <Lock className="size-3" aria-hidden />
                  {copy.engLocked}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
        <h2 className="title-section text-[1.15rem]">{copy.engNotes}</h2>
        {engagement.message ? (
          <blockquote className="rounded-control bg-surface-sunken px-4 py-3 text-sm">{engagement.message}</blockquote>
        ) : null}
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          {noteRows.map(([label, value]) => (
            <div key={label} className="grid gap-0.5">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
              <dd>{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>

      {engagement.state === "changes_proposed" && engagement.proposal ? (
        <>
          <ProposalDiff proposal={engagement.proposal} currentRate={engagement.rate_minor} />
          <p className="text-sm text-text-muted">{copy.engWaiting}</p>
        </>
      ) : null}
      {engagement.state === "accepted" ? <p className="text-sm text-text-muted">{copy.engWaiting}</p> : null}
      {engagement.state === "confirmed" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline">
            <LocaleLink href={`/guide/day/${engagement.id}`}>{copy.engItinerary}</LocaleLink>
          </Button>
          <ReportProblem engagementId={engagement.id} />
        </div>
      ) : null}

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {engagement.state === "requested" ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void run("accept", () => answerEngagement(engagement.id, "accept"))}
            >
              {busy === "accept" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              {copy.engAccept}
            </Button>
            <Button type="button" variant="outline" onClick={() => setProposing((value) => !value)}>
              {copy.engPropose}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="decline-reason">{copy.engDeclineReason}</Label>
              <Input id="decline-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null || !reason.trim()}
              onClick={() => void run("decline", () => answerEngagement(engagement.id, "decline", reason.trim()))}
            >
              <X aria-hidden />
              {copy.engDecline}
            </Button>
          </div>
        </section>
      ) : null}
      {proposing && engagement.state === "requested" ? (
        <ProposalEditor
          engagement={engagement}
          onSent={(next) => {
            setEngagement(next);
            setProposing(false);
          }}
        />
      ) : null}

      {active && engagement.state !== "requested" ? (
        <section className="grid gap-2 border-t border-border-subtle pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="cancel-reason">{copy.engCancelReason}</Label>
            <Input id="cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <Button
            type="button"
            variant="ghost"
            disabled={busy !== null || !reason.trim()}
            onClick={() => void run("cancel", () => cancelEngagement(engagement.id, reason.trim()))}
          >
            {copy.engCancel}
          </Button>
        </section>
      ) : null}
    </div>
  );
}

/** /guide/requests/[id]: one hired day, with accept, decline or propose changes. */
export function EngagementDetail({ engagementId }: { engagementId: string }) {
  return <ApprovedGuide>{() => <Detail engagementId={engagementId} />}</ApprovedGuide>;
}
