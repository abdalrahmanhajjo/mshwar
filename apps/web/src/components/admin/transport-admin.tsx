"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { DestinationSelect } from "@/components/guide/pickers";
import { TransportCardView } from "@/components/local/transport-card";
import { errorText } from "@/components/partners/step";
import { TransportCardForm } from "@/components/transport/transport-card-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { interpolate } from "@/i18n/catalogues";
import { useAdminTrustCopy, type AdminTrustKey } from "@/lib/admin-trust-copy";
import { beirutToday } from "@/lib/local-time";
import { useLocalCopy, type LocalKey } from "@/lib/local-copy";
import {
  cardToInput,
  createTransportCard,
  decideTransportCard,
  editTransportCard,
  fetchAdminTransport,
  type TransportCardPrivate,
} from "@/lib/transport";

const STATUSES = ["submitted", "published", "rejected", "retired"] as const;
type Status = (typeof STATUSES)[number];

function Decision({ card, onChange }: { card: TransportCardPrivate; onChange: (next: TransportCardPrivate) => void }) {
  const copy = useAdminTrustCopy();
  const [checkedOn, setCheckedOn] = React.useState(beirutToday());
  const [note, setNote] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function decide(decision: "published" | "rejected" | "retired") {
    setBusy(true);
    setError(null);
    try {
      onChange(
        await decideTransportCard(card.id, {
          decision,
          ...(decision === "published" ? { checked_on: checkedOn, field_check_note: note.trim() } : {}),
          reason: reason.trim(),
        }),
      );
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-control bg-surface-sunken p-3">
      {card.status !== "published" ? (
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="grid gap-1.5">
            <Label htmlFor={`checked-${card.id}`}>{copy.fieldCheckOn}</Label>
            <Input
              id={`checked-${card.id}`}
              type="date"
              max={beirutToday()}
              value={checkedOn}
              onChange={(event) => setCheckedOn(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`note-${card.id}`}>{copy.fieldCheckNote}</Label>
            <Input
              id={`note-${card.id}`}
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`reason-${card.id}`}>{copy.decisionReasonShort}</Label>
        <Textarea
          id={`reason-${card.id}`}
          rows={1}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {card.status !== "published" ? (
          <Button
            type="button"
            size="sm"
            disabled={busy || note.trim().length < 5}
            onClick={() => void decide("published")}
          >
            {copy.publish}
          </Button>
        ) : null}
        {card.status === "submitted" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || reason.trim().length < 3}
            onClick={() => void decide("rejected")}
          >
            {copy.rejectApp}
          </Button>
        ) : null}
        {card.status === "published" ? (
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void decide("retired")}>
            {copy.retire}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CardRow({ card, onChange }: { card: TransportCardPrivate; onChange: (next: TransportCardPrivate) => void }) {
  const copy = useAdminTrustCopy();
  const local = useLocalCopy();
  const [editing, setEditing] = React.useState(false);

  if (editing) {
    return (
      <li className="grid gap-3 rounded-card border border-border bg-surface-raised p-4">
        <TransportCardForm
          initial={cardToInput(card)}
          submitLabel={copy.saveCard}
          evidenceKinds={["field_check", "operator", "guide_report", "traveller_report"]}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            onChange(await editTransportCard(card.id, input));
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline">{copy[`tst_${card.status}` as AdminTrustKey]}</Badge>
        <span className="text-text-muted">
          {card.to.name} ·{" "}
          {interpolate(copy.submittedBy, { role: copy[`role_${card.submitted_role}` as AdminTrustKey] })}
          {card.submitted_by ? ` (${card.submitted_by})` : ""}
        </span>
        {card.replaces_route_id ? <Badge variant="secondary">{copy.replaces}</Badge> : null}
        <Button type="button" size="sm" variant="ghost" className="ms-auto" onClick={() => setEditing(true)}>
          {copy.editCard}
        </Button>
      </div>
      <TransportCardView card={card} flaggable={false} />
      <div className="grid gap-1 text-sm">
        <p className="font-medium">{copy.evidenceTitle}</p>
        <ul className="grid gap-1 text-text-muted">
          {card.evidence.map((item, index) => (
            <li key={`${item.kind}-${index}`}>
              {copy[`ev_${item.kind}` as AdminTrustKey]}
              {item.on ? ` · ${item.on}` : ""} · {item.note}
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer" className="ms-1 underline">
                  ↗
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      {card.open_flags.length ? (
        <div className="grid gap-1 text-sm">
          <p className="font-medium text-warning">
            {copy.flagsTitle} ({card.open_flags.length})
          </p>
          <ul className="grid gap-1 text-text-muted">
            {card.open_flags.map((flag, index) => (
              <li key={`${flag.at}-${index}`}>
                {local[`flag_${flag.reason}` as LocalKey]}
                {flag.details ? ` · ${flag.details}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {card.decision_reason ? <p className="text-sm text-text-muted">{card.decision_reason}</p> : null}
      <Decision card={card} onChange={onChange} />
    </li>
  );
}

/** /admin/transport: cards waiting, flagged or due, and a form for new ones. */
export function TransportAdmin() {
  const copy = useAdminTrustCopy();
  const [status, setStatus] = React.useState<Status>("submitted");
  const [destination, setDestination] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [result, setResult] = React.useState<{ key: string; cards: TransportCardPrivate[] } | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const key = `${status}:${destination}:${version}`;

  React.useEffect(() => {
    let cancelled = false;
    void fetchAdminTransport(status, destination || undefined)
      .then((cards) => {
        if (!cancelled) {
          setResult({ key, cards });
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, destination, key]);

  const cards = result?.key === key ? result.cards : null;
  const replace = (next: TransportCardPrivate) =>
    setResult((current) =>
      current ? { ...current, cards: current.cards.map((card) => (card.id === next.id ? next : card)) } : current,
    );

  return (
    <div className="grid gap-6">
      <PageHeader
        title={copy.ttTitle}
        description={copy.ttBody}
        actions={
          creating ? null : (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              {copy.newCard}
            </Button>
          )
        }
      />
      {creating ? (
        <section className="rounded-card border border-border bg-surface-raised p-4 md:p-6">
          <TransportCardForm
            submitLabel={copy.saveCard}
            evidenceKinds={["field_check", "operator", "guide_report", "traveller_report"]}
            onCancel={() => setCreating(false)}
            onSubmit={async (input) => {
              await createTransportCard(input);
              setCreating(false);
              setStatus("submitted");
              setVersion((value) => value + 1);
            }}
          />
        </section>
      ) : null}
      <div className="flex flex-wrap gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="tt-status">{copy.statusLabel}</Label>
          <NativeSelect id="tt-status" value={status} onChange={(event) => setStatus(event.target.value as Status)}>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {copy[`tst_${value}`]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tt-destination">{copy.destinationLabel}</Label>
          <DestinationSelect
            id="tt-destination"
            value={destination}
            onChange={setDestination}
            allowAny
            anyLabel={copy.anyDestination}
          />
        </div>
      </div>
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : cards === null ? (
        <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden />
      ) : cards.length === 0 ? (
        <EmptyState title={copy.noCards} />
      ) : (
        <ul className="grid gap-4">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} onChange={replace} />
          ))}
        </ul>
      )}
    </div>
  );
}
