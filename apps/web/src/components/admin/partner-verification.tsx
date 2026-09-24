"use client";

import * as React from "react";
import { BadgeCheck, ChevronLeft, ExternalLink, Loader2 } from "lucide-react";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { documentLabel } from "@/components/verified/document-uploader";
import { TrustBadge } from "@/components/verified/what-we-checked";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import {
  decidePartner,
  fetchPartnerCase,
  fetchPartnerQueue,
  fetchRecheckSample,
  recordPartnerCheck,
  reviewPartnerDocument,
  type PartnerCase,
  type PartnerQueueRow,
} from "@/lib/admin-trust";
import { useAdminTrustCopy, type AdminTrustKey } from "@/lib/admin-trust-copy";
import type { PartnerDocument, PartnerKind, PartnerStatus } from "@/lib/partners";
import { useVerifiedCopy } from "@/lib/verified-copy";
import { cn, focusRing } from "@/lib/utils";

type StatusFilter = PartnerStatus | "lapsed";
const STATUSES: StatusFilter[] = ["submitted", "lapsed", "approved", "suspended", "rejected", "draft"];

function useShortDate() {
  const { locale } = useLocale();
  return (value: string | null | undefined) =>
    value ? formatDate(locale, value.length === 10 ? `${value}T12:00:00Z` : value, { dateStyle: "medium" }) : "";
}

function DocumentRow({
  document,
  partnerCase,
  busy,
  onDecide,
}: {
  document: PartnerDocument;
  partnerCase: PartnerCase;
  busy: boolean;
  onDecide: (decision: "verified" | "rejected", reason: string) => void;
}) {
  const copy = useAdminTrustCopy();
  const verified = useVerifiedCopy();
  const day = useShortDate();
  const [reason, setReason] = React.useState(document.reason);
  const link = partnerCase.document_links[document.id];
  const plate = document.vehicle_id
    ? partnerCase.vehicles.find((vehicle) => vehicle.id === document.vehicle_id)?.plate
    : null;
  const tone =
    document.verification === "verified" && document.valid
      ? "success"
      : document.verification === "rejected" || !document.valid
        ? "danger"
        : "warning";
  const state =
    document.verification === "verified" && !document.valid
      ? verified.doc_lapsed
      : verified[`doc_${document.verification}` as keyof typeof verified];

  return (
    <li className="grid gap-3 rounded-control border border-border-subtle bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{documentLabel(document.kind, verified)}</span>
        {plate ? <Badge variant="outline">{interpolate(copy.forVehicle, { plate })}</Badge> : null}
        <Badge variant={tone}>{state}</Badge>
      </div>
      <p className="text-xs text-text-muted">
        {[
          document.reference ? interpolate(copy.reference, { ref: document.reference }) : null,
          document.issuer ? interpolate(copy.issuer, { issuer: document.issuer }) : null,
          document.issued_on ? interpolate(copy.issuedOn, { date: day(document.issued_on) }) : null,
          document.expires_on ? interpolate(copy.expiresOn, { date: day(document.expires_on) }) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1 text-sm underline"
        >
          {copy.openDocument}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`reason-${document.id}`} className="text-xs">
          {copy.rejectReason}
        </Label>
        <Textarea
          id={`reason-${document.id}`}
          rows={1}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => onDecide("verified", "")}>
          <BadgeCheck aria-hidden />
          {copy.verifyDoc}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || reason.trim().length < 3}
          onClick={() => onDecide("rejected", reason.trim())}
        >
          {copy.rejectDoc}
        </Button>
      </div>
    </li>
  );
}

function PartnerCaseView({ id, onBack }: { id: string; onBack: () => void }) {
  const copy = useAdminTrustCopy();
  const verified = useVerifiedCopy();
  const day = useShortDate();
  const [partnerCase, setPartnerCase] = React.useState<PartnerCase | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [checkKind, setCheckKind] = React.useState<"video_call" | "visit" | "recheck">("video_call");
  const [outcome, setOutcome] = React.useState<"ok" | "concern">("ok");
  const [notes, setNotes] = React.useState("");
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    void fetchPartnerCase(id)
      .then((next) => {
        if (!cancelled) setPartnerCase(next);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(errorText(caught, copy.loadError));
      });
    return () => {
      cancelled = true;
    };
  }, [id, copy.loadError]);

  async function run(task: () => Promise<PartnerCase>) {
    setBusy(true);
    setError(null);
    try {
      setPartnerCase(await task());
      return true;
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const backButton = (
    <Button type="button" variant="ghost" className="w-fit" onClick={onBack}>
      <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
      {copy.back}
    </Button>
  );
  if (!partnerCase) {
    return (
      <div className="grid gap-4">
        {backButton}
        {error ? (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        ) : (
          <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden />
        )}
      </div>
    );
  }

  const met = partnerCase.trust.in_person;
  const blocked = partnerCase.missing.length > 0 || !met;
  const security = partnerCase.security;

  return (
    <div className="grid gap-6">
      {backButton}
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="title-section text-[1.4rem]">{partnerCase.display_name}</h2>
          <Badge variant="secondary">{copy[`kind_${partnerCase.kind}` as AdminTrustKey]}</Badge>
          <Badge variant="outline">{copy[`st_${partnerCase.status}` as AdminTrustKey]}</Badge>
          <TrustBadge level={partnerCase.trust_level} />
        </div>
        <p className="text-sm text-text-muted">
          {interpolate(copy.securityLine, {
            phone: security.phone
              ? `${security.phone}${security.phone_verified ? "" : ` (${copy.unverifiedPhone})`}`
              : "—",
            totp: security.totp_enabled ? copy.on : copy.off,
          })}
        </p>
        {partnerCase.headline ? <p>{partnerCase.headline}</p> : null}
        {partnerCase.bio ? (
          <p className="max-w-2xl whitespace-pre-line text-sm text-text-muted">{partnerCase.bio}</p>
        ) : null}
        {partnerCase.vehicles.length ? (
          <ul className="flex flex-wrap gap-2 text-sm">
            {partnerCase.vehicles.map((vehicle) => (
              <li key={vehicle.id} className="rounded-pill bg-surface-sunken px-3 py-1" dir="ltr">
                {vehicle.plate} · {vehicle.make} {vehicle.model} · {vehicle.seats}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      <section className="grid gap-3">
        <h3 className="font-semibold">{copy.documentsTitle}</h3>
        <ul className="grid gap-3 lg:grid-cols-2">
          {partnerCase.documents.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              partnerCase={partnerCase}
              busy={busy}
              onDecide={(decision, why) => void run(() => reviewPartnerDocument(document.id, decision, why))}
            />
          ))}
        </ul>
        {partnerCase.missing.length ? (
          <div className="grid gap-1 text-sm">
            <p className="font-medium">{copy.missingTitle}</p>
            <ul className="list-inside list-disc text-text-muted">
              {partnerCase.missing.map((item) => (
                <li key={`${item.kind}-${item.vehicle_id ?? item.office_id ?? ""}`}>
                  {documentLabel(item.kind, verified)}
                  {item.plate ? ` (${item.plate})` : item.branch ? ` (${item.branch})` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4">
        <h3 className="font-semibold">{copy.checksTitle}</h3>
        {met ? (
          <p className="text-sm text-text-muted">
            {copy[`check_${met.kind}` as AdminTrustKey]} · {day(met.on)}
          </p>
        ) : null}
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => recordPartnerCheck(partnerCase.id, checkKind, notes.trim(), outcome)).then((ok) => {
              if (ok) setNotes("");
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="check-kind">{copy.kindLabel}</Label>
              <NativeSelect
                id="check-kind"
                value={checkKind}
                onChange={(event) => setCheckKind(event.target.value as typeof checkKind)}
              >
                {(["video_call", "visit", "recheck"] as const).map((value) => (
                  <option key={value} value={value}>
                    {copy[`check_${value}`]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="check-outcome">{copy.statusLabel}</Label>
              <NativeSelect
                id="check-outcome"
                value={outcome}
                onChange={(event) => setOutcome(event.target.value as typeof outcome)}
              >
                <option value="ok">{copy.outcome_ok}</option>
                <option value="concern">{copy.outcome_concern}</option>
              </NativeSelect>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="check-notes">{copy.checkNotes}</Label>
            <Textarea id="check-notes" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
          <Button type="submit" size="sm" className="w-fit" disabled={busy || notes.trim().length < 10}>
            {copy.recordCheck}
          </Button>
        </form>
      </section>

      <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4">
        <h3 className="font-semibold">{copy.decisionTitle}</h3>
        {blocked ? <Notice tone="info">{copy.approveBlocked}</Notice> : null}
        <div className="grid gap-1.5">
          <Label htmlFor="decision-reason">{copy.decisionReason}</Label>
          <Textarea id="decision-reason" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy || blocked}
            onClick={() => void run(() => decidePartner(partnerCase.id, "approved", reason.trim()))}
          >
            {copy.approve}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || reason.trim().length < 5}
            onClick={() => void run(() => decidePartner(partnerCase.id, "rejected", reason.trim()))}
          >
            {copy.rejectApp}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy || reason.trim().length < 5 || partnerCase.status !== "approved"}
            onClick={() => void run(() => decidePartner(partnerCase.id, "suspended", reason.trim()))}
          >
            {copy.suspend}
          </Button>
        </div>
      </section>

      {partnerCase.events.length ? (
        <section className="grid gap-2">
          <h3 className="font-semibold">{copy.eventsTitle}</h3>
          <ol className="grid gap-1 text-sm">
            {partnerCase.events.map((event, index) => (
              <li key={`${event.at}-${index}`} className="flex flex-wrap gap-x-2 text-text-muted">
                <span className="tabular-nums">{day(event.at)}</span>
                <span className="font-medium text-text">{event.event.replace(/_/g, " ")}</span>
                {event.actor ? <span>· {event.actor}</span> : null}
                {event.reason ? <span>· {event.reason}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function RecheckSample({ kind, onOpen }: { kind: PartnerKind; onOpen: (id: string) => void }) {
  const copy = useAdminTrustCopy();
  const day = useShortDate();
  const [rows, setRows] = React.useState<Awaited<ReturnType<typeof fetchRecheckSample>> | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void fetchRecheckSample(kind)
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);
  if (!rows || rows.length === 0) {
    return null;
  }
  return (
    <section className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-4">
      <h2 className="font-semibold">
        {copy.recheckTitle} · {copy[`kind_${kind}`]}
      </h2>
      <p className="text-sm text-text-muted">{copy.recheckBody}</p>
      <ul className="grid gap-1 text-sm">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn("font-medium underline-offset-4 hover:underline", focusRing)}
              onClick={() => onOpen(row.id)}
            >
              {row.display_name}
            </button>
            <span className="text-text-muted">
              {row.last_in_person ? interpolate(copy.lastMet, { date: day(row.last_in_person) }) : copy.neverMet}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** /admin/verification: drivers and changers waiting, then one case at a time. */
export function PartnerVerification() {
  const copy = useAdminTrustCopy();
  const [kind, setKind] = React.useState<PartnerKind | "">("");
  const [status, setStatus] = React.useState<StatusFilter>("submitted");
  const [rows, setRows] = React.useState<{ key: string; rows: PartnerQueueRow[] } | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const key = `${kind}:${status}:${version}`;

  React.useEffect(() => {
    let cancelled = false;
    void fetchPartnerQueue({ kind: kind || undefined, status })
      .then((next) => {
        if (!cancelled) {
          setRows({ key, rows: next });
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, status, key]);

  if (openId) {
    return (
      <PartnerCaseView
        id={openId}
        onBack={() => {
          setOpenId(null);
          setVersion((value) => value + 1);
        }}
      />
    );
  }

  const current = rows?.key === key ? rows.rows : null;
  return (
    <div className="grid gap-6">
      <PageHeader title={copy.vqTitle} description={copy.vqBody} />
      <div className="flex flex-wrap gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="vq-kind">{copy.kindLabel}</Label>
          <NativeSelect id="vq-kind" value={kind} onChange={(event) => setKind(event.target.value as PartnerKind | "")}>
            <option value="">{copy.all}</option>
            <option value="driver">{copy.kind_driver}</option>
            <option value="changer">{copy.kind_changer}</option>
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="vq-status">{copy.statusLabel}</Label>
          <NativeSelect
            id="vq-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {copy[`st_${value}` as AdminTrustKey]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : current === null ? (
        <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden />
      ) : current.length === 0 ? (
        <EmptyState title={copy.queueEmpty} />
      ) : (
        <ul className="grid gap-3">
          {current.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setOpenId(row.id)}
                className={cn(
                  "flex w-full flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 text-start hover:border-border",
                  focusRing,
                )}
              >
                <span className="grid gap-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {row.display_name}
                    <Badge variant="secondary">{copy[`kind_${row.kind}` as AdminTrustKey]}</Badge>
                    <TrustBadge level={row.trust_level} />
                  </span>
                  <span className="text-sm text-text-muted">
                    {[
                      row.waiting_hours !== null
                        ? interpolate(copy.waitingHours, { n: String(Math.round(row.waiting_hours)) })
                        : null,
                      row.pending_documents
                        ? interpolate(copy.pendingDocs, { n: String(row.pending_documents) })
                        : null,
                      row.missing.length ? interpolate(copy.missingN, { n: String(row.missing.length) }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="text-sm font-medium">{copy.open}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecheckSample kind="driver" onOpen={setOpenId} />
        <RecheckSample kind="changer" onOpen={setOpenId} />
      </div>
    </div>
  );
}
