"use client";

import * as React from "react";
import { Check, ExternalLink, Loader2, MapPinned, X } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { interpolate } from "@/i18n/catalogues";
import { ApiError } from "@/lib/api/client";
import { useContributeCopy } from "@/lib/contribute-copy";
import { decideProposal, fetchProposalQueue, type QueuedProposal } from "@/lib/guide-contribute";

const COMPARED = ["title", "description", "address"] as const;

function ProposalCase({ proposal, onDecided }: { proposal: QueuedProposal; onDecided: () => void }) {
  const copy = useContributeCopy();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState<null | "accepted" | "rejected">(null);
  const [error, setError] = React.useState<string | null>(null);
  const place = proposal.payload;

  async function decide(decision: "accepted" | "rejected") {
    setBusy(decision);
    setError(null);
    try {
      await decideProposal(proposal.id, decision, reason.trim());
      onDecided();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="title-card">
            {proposal.kind === "new" ? place.name : (proposal.target?.title ?? place.title)}
          </span>
          <span className="text-sm text-text-muted">
            {interpolate(copy.queueFrom, {
              name: proposal.guide.display_name,
              accepted: String(proposal.allowance.accepted),
              rejected: String(proposal.allowance.rejected),
            })}
          </span>
        </div>
        <Badge variant="secondary">{proposal.kind === "new" ? copy.kindNew : copy.kindCorrection}</Badge>
      </div>

      {proposal.kind === "new" ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{copy.description}</dt>
            <dd className="whitespace-pre-line">{place.description}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{copy.category}</dt>
            <dd>{place.category}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{copy.destination}</dt>
            <dd>{place.destination_slug}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{copy.address}</dt>
            <dd>
              {place.address ? `${place.address} · ` : ""}
              <a
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lng}#map=17/${place.lat}/${place.lng}`}
              >
                {place.lat}, {place.lng}
              </a>
            </dd>
          </div>
        </dl>
      ) : (
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-text-muted">
              <th className="py-1 text-start font-medium" />
              <th className="py-1 text-start font-medium">{copy.queueCurrent}</th>
              <th className="py-1 text-start font-medium">{copy.queueProposed}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {COMPARED.filter((key) => place[key]).map((key) => (
              <tr key={key}>
                <td className="py-2 pe-3 align-top font-medium">{key}</td>
                <td className="py-2 pe-3 align-top text-text-muted">{proposal.target?.[key]}</td>
                <td className="py-2 align-top">{place[key]}</td>
              </tr>
            ))}
            {place.lat !== undefined ? (
              <tr>
                <td className="py-2 pe-3 font-medium">pin</td>
                <td className="py-2 pe-3 text-text-muted">
                  {proposal.target?.lat}, {proposal.target?.lng}
                </td>
                <td className="py-2">
                  {place.lat}, {place.lng}
                </td>
              </tr>
            ) : null}
            {place.closed ? (
              <tr>
                <td className="py-2 pe-3 font-medium" colSpan={3}>
                  {copy.closed}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      )}
      {place.note ? <p className="rounded-control bg-surface-sunken px-3 py-2 text-sm">{place.note}</p> : null}

      <div className="grid gap-1 text-sm">
        <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{copy.evidence}</span>
        <ul className="grid gap-1">
          {proposal.evidence_urls.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                {url}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {proposal.photos.length ? (
        <ul className="flex flex-wrap gap-3">
          {proposal.photos.map((photo) => (
            <li key={photo.id} className="grid w-40 gap-1 text-xs text-text-muted">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed or external URL shown for review only
                <img src={photo.url} alt={photo.alt_text} className="aspect-square w-40 rounded-control object-cover" />
              ) : null}
              <span>{interpolate(copy.queueLicense, { license: photo.license, author: photo.attribution })}</span>
              {photo.source_url ? (
                <a href={photo.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                  Commons
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="grid gap-2 border-t border-border-subtle pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`reason-${proposal.id}`}>{copy.queueReason}</Label>
          <Input id={`reason-${proposal.id}`} value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" disabled={busy !== null} onClick={() => void decide("accepted")}>
            {busy === "accepted" ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            {copy.queueAccept}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || !reason.trim()}
            onClick={() => void decide("rejected")}
          >
            <X aria-hidden />
            {copy.queueReject}
          </Button>
        </div>
      </div>
      {proposal.target ? (
        <LocaleLink href={`/experiences/${proposal.target.slug}`} className="text-sm underline">
          {proposal.target.slug}
        </LocaleLink>
      ) : null}
    </li>
  );
}

/** /admin/proposals: the review queue for guides' new places and corrections. */
export function ProposalQueue() {
  const copy = useContributeCopy();
  const [rows, setRows] = React.useState<QueuedProposal[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void fetchProposalQueue()
      .then((next) => {
        if (!cancelled) {
          setRows(next);
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
  }, [version]);

  return (
    <div className="grid gap-8">
      <PageHeader icon={<MapPinned aria-hidden />} title={copy.queueTitle} description={copy.queueBody} />
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : rows === null ? (
        <div className="grid place-items-center py-16 text-text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<MapPinned aria-hidden />} title={copy.queueEmpty} />
      ) : (
        <ul className="grid gap-4">
          {rows.map((row) => (
            <ProposalCase key={row.id} proposal={row} onDecided={() => setVersion((value) => value + 1)} />
          ))}
        </ul>
      )}
    </div>
  );
}
