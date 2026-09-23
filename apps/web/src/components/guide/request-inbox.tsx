"use client";

import * as React from "react";
import { Banknote, Check, Clock, Inbox, Loader2, MessageSquareQuote, Users, X } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideWorkCopy, type GuideWorkCopy } from "@/lib/guide-work-copy";
import { fetchGuideRequests, respondGuideRequest, type GuideRequest } from "@/lib/guide-work";
import { BOOKING_STATUS_VARIANT } from "@/lib/status";

type Filter = "pending" | "confirmed" | "all";

export function requestStatusLabel(status: string, copy: GuideWorkCopy): string {
  switch (status) {
    case "pending":
      return copy.statusPending;
    case "confirmed":
      return copy.statusConfirmed;
    case "rejected":
      return copy.statusRejected;
    case "cancelled":
      return copy.statusCancelled;
    case "completed":
      return copy.statusCompleted;
    case "expired":
      return copy.statusExpired;
    default:
      return status;
  }
}

function RequestCard({ row, onAnswered }: { row: GuideRequest; onAnswered: () => void }) {
  const copy = useGuideWorkCopy();
  const { locale } = useLocale();
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<null | "confirmed" | "rejected">(null);
  const [error, setError] = React.useState<string | null>(null);
  const start = new Date(row.starts_at);

  async function answer(status: "confirmed" | "rejected") {
    setBusy(status);
    setError(null);
    const reason = note.trim() || (status === "confirmed" ? copy.requestNoteConfirm : copy.requestNoteDecline);
    try {
      await respondGuideRequest(row.id, { status, reason, message: reason });
      onAnswered();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm md:grid-cols-[4.5rem_1fr] md:p-6">
      <div className="grid h-fit w-[4.5rem] justify-items-center rounded-control bg-brand text-brand-foreground">
        <span className="pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] opacity-75">
          {formatDate(locale, start, { dateStyle: undefined, month: "short" })}
        </span>
        <span className="pb-2 text-3xl font-semibold leading-tight tabular-nums">
          {formatDate(locale, start, { dateStyle: undefined, day: "numeric" })}
        </span>
      </div>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="title-card">{row.experience_title}</h2>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3.5" aria-hidden />
                {formatDate(locale, start, { dateStyle: "full", timeStyle: "short" })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                {interpolate(copy.requestParty, { n: String(row.party_size) })}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-text">
                <Banknote className="size-3.5" aria-hidden />
                {row.total_minor
                  ? interpolate(copy.requestCollect, {
                      amount: formatCurrency(locale, row.total_minor / 100, row.currency || "USD"),
                    })
                  : copy.requestFree}
              </span>
            </p>
          </div>
          <Badge variant={BOOKING_STATUS_VARIANT[row.status] ?? "secondary"}>
            {requestStatusLabel(row.status, copy)}
          </Badge>
        </div>
        {row.traveller_note ? (
          <blockquote className="flex gap-2 rounded-control bg-surface-sunken px-4 py-3 text-sm">
            <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
            {row.traveller_note}
          </blockquote>
        ) : null}
        {error ? (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        ) : null}
        {row.status === "pending" ? (
          <div className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor={`note-${row.id}`}>{copy.requestNote}</Label>
              <Input
                id={`note-${row.id}`}
                value={note}
                placeholder={copy.requestNoteConfirm}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy !== null} onClick={() => void answer("confirmed")}>
                {busy === "confirmed" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                {copy.requestConfirm}
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void answer("rejected")}>
                {busy === "rejected" ? <Loader2 className="animate-spin" aria-hidden /> : <X aria-hidden />}
                {copy.requestDecline}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

function Requests() {
  const copy = useGuideWorkCopy();
  const [filter, setFilter] = React.useState<Filter>("pending");
  const [rows, setRows] = React.useState<GuideRequest[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void fetchGuideRequests(filter === "all" ? undefined : filter)
      .then((next) => {
        if (!cancelled) {
          setRows(next);
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
  }, [filter, version]);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.portalKicker}
        icon={<Inbox aria-hidden />}
        title={copy.requestsTitle}
        description={copy.requestsBody}
      />
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setRows(null);
          setFilter(value as Filter);
        }}
      >
        <TabsList>
          <TabsTrigger value="pending">{copy.requestsPending}</TabsTrigger>
          <TabsTrigger value="confirmed">{copy.requestsConfirmed}</TabsTrigger>
          <TabsTrigger value="all">{copy.requestsAll}</TabsTrigger>
        </TabsList>
      </Tabs>
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : rows === null ? (
        <div className="grid place-items-center py-16 text-text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<Inbox aria-hidden />} title={copy.requestsEmpty} />
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => (
            <RequestCard key={row.id} row={row} onAnswered={() => setVersion((value) => value + 1)} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** /guide/requests: the booking inbox, lifted and narrowed to what a guide answers. */
export function RequestInbox() {
  return <ApprovedGuide>{() => <Requests />}</ApprovedGuide>;
}
