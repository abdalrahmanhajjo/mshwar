"use client";

import * as React from "react";
import { BadgeCheck, ChevronLeft, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { documentLabel } from "@/components/guide/guide-application";
import { useGuideCopy, type GuideCopy } from "@/lib/guide-copy";
import {
  decideGuideApplication,
  fetchGuideCase,
  fetchGuideQueue,
  reviewGuideDocument,
  type GuideApplicationRow,
  type GuideCase,
} from "@/lib/guides";
import { ApiError } from "@/lib/api/client";
import { interpolate } from "@/i18n/catalogues";
import { cn, focusRing } from "@/lib/utils";

const FILTERS = ["submitted", "approved", "rejected", ""] as const;

function CaseView({
  guideCase,
  copy,
  pending,
  onDocument,
  onDecision,
  onBack,
}: {
  guideCase: GuideCase;
  copy: GuideCopy;
  pending: boolean;
  onDocument: (id: string, decision: "verified" | "rejected", reason: string) => void;
  onDecision: (decision: "approved" | "rejected" | "suspended", reason: string) => void;
  onBack: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const required = new Set(guideCase.required_documents);
  // Approval is refused server-side until every required document is verified;
  // saying so here means the reviewer is not guessing why the button is off.
  const blocked = guideCase.required_documents.some(
    (kind) => !guideCase.documents.some((doc) => doc.kind === kind && doc.verification === "verified"),
  );

  return (
    <div className="grid gap-5">
      <Button type="button" variant="ghost" className="w-fit" onClick={onBack}>
        <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
        {copy.reviewBack}
      </Button>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="title-section text-[1.3rem]">{guideCase.display_name}</h2>
        <Badge variant="secondary">{guideCase.tier === "licensed" ? copy.badgeLicensed : copy.badgeHost}</Badge>
        {guideCase.badge ? (
          <Badge variant="accent" className="gap-1">
            <BadgeCheck className="size-3.5" aria-hidden />
            {copy.badgeLicensed}
          </Badge>
        ) : null}
      </div>
      {guideCase.headline ? <p className="text-text-muted">{guideCase.headline}</p> : null}
      {guideCase.bio ? <p className="max-w-2xl whitespace-pre-line text-sm">{guideCase.bio}</p> : null}

      <ul className="grid gap-3">
        {guideCase.documents.map((document) => (
          <li key={document.id} className="grid gap-2 rounded-control border border-border-subtle bg-surface p-3">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{documentLabel(document.kind, copy)}</span>
              <Badge variant={required.has(document.kind) ? "secondary" : "outline"} className="text-xs">
                {required.has(document.kind) ? copy.documentRequired : copy.documentOptional}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  document.verification === "verified" && !document.expired && "text-success",
                  (document.verification === "rejected" || document.expired) && "text-danger",
                )}
              >
                {document.expired
                  ? copy.documentExpired
                  : { pending: copy.documentPending, verified: copy.documentVerified, rejected: copy.documentRejected }[
                      document.verification
                    ]}
              </Badge>
            </span>
            <span className="break-all font-mono text-xs text-text-muted">
              {guideCase.document_keys[document.kind] ?? ""}
              {document.expires_on ? ` · ${copy.documentExpires} ${document.expires_on}` : ""}
            </span>
            <span className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => onDocument(document.id, "verified", "")}
              >
                {copy.reviewVerify}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onDocument(document.id, "rejected", reason)}
              >
                {copy.reviewReject}
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <label className="grid max-w-xl gap-1.5 text-sm font-medium">
        {copy.reviewReason}
        <Input
          value={reason}
          placeholder={copy.reviewReasonPlaceholder}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={pending || blocked} onClick={() => onDecision("approved", reason)}>
          {copy.reviewApprove}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => onDecision("rejected", reason)}>
          {copy.reviewReject}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => onDecision("suspended", reason)}>
          {copy.reviewSuspend}
        </Button>
        {blocked ? <span className="text-sm text-text-muted">{copy.reviewBlocked}</span> : null}
      </div>
    </div>
  );
}

/** The verification queue: documents first, then the decision. */
export function GuideQueue() {
  const copy = useGuideCopy();
  const [filter, setFilter] = React.useState<string>("submitted");
  const [rows, setRows] = React.useState<GuideApplicationRow[]>([]);
  const [guideCase, setGuideCase] = React.useState<GuideCase | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (status: string) => {
      try {
        setRows(await fetchGuideQueue(status || undefined));
        setError(null);
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : copy.loadError);
      } finally {
        setLoading(false);
      }
    },
    [copy.loadError],
  );

  // The spinner is turned on by whoever changes the filter - an event, not this
  // effect - so nothing sets state synchronously while React is rendering.
  React.useEffect(() => {
    let cancelled = false;
    fetchGuideQueue(filter || undefined)
      .then((next) => {
        if (!cancelled) {
          setRows(next);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : copy.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filter, copy.loadError]);

  async function act(task: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await task();
      if (guideCase) {
        setGuideCase(await fetchGuideCase(guideCase.id));
      }
      await load(filter);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={copy.kicker} title={copy.queueTitle} description={copy.queueBody} />

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {guideCase ? (
        <CaseView
          guideCase={guideCase}
          copy={copy}
          pending={pending}
          onBack={() => setGuideCase(null)}
          onDocument={(id, decision, reason) => void act(() => reviewGuideDocument(id, decision, reason))}
          onDecision={(decision, reason) => void act(() => decideGuideApplication(guideCase.id, decision, reason))}
        />
      ) : (
        <>
          <div role="group" aria-label={copy.queueFilterAll} className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <button
                key={item || "all"}
                type="button"
                aria-pressed={filter === item}
                onClick={() => {
                  setLoading(true);
                  setFilter(item);
                }}
                className={cn(
                  "rounded-pill border px-4 py-1.5 text-sm font-medium transition-colors",
                  filter === item
                    ? "border-brand bg-brand text-white"
                    : "border-border-subtle text-text-muted hover:bg-surface-sunken",
                  focusRing,
                )}
              >
                {item ? item : copy.queueFilterAll}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid place-items-center py-16 text-text-muted">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : rows.length ? (
            <ul className="grid gap-3">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface-raised p-4"
                >
                  <span className="grid gap-1">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {row.display_name}
                      <Badge variant="outline" className="text-xs">
                        {row.tier === "licensed" ? copy.badgeLicensed : copy.badgeHost}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {row.status}
                      </Badge>
                    </span>
                    <span className="text-xs text-text-muted">
                      {interpolate(copy.queueDocuments, { n: row.document_count })}
                      {row.missing_documents.length
                        ? ` · ${copy.queueMissing}: ${row.missing_documents
                            .map((kind) => documentLabel(kind, copy))
                            .join(", ")}`
                        : ""}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void act(async () => setGuideCase(await fetchGuideCase(row.id)))}
                  >
                    {copy.queueReview}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Notice role="status">{copy.queueEmpty}</Notice>
          )}
        </>
      )}
    </div>
  );
}
