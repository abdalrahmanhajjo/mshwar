"use client";

import { ArrowRightLeft, Clock, Minus, Plus } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency } from "@/i18n/format";
import { useGuideHireCopy } from "@/lib/guide-hire-copy";
import { beirutTime, type Proposal } from "@/lib/guide-hire";

/**
 * A guide's counter-proposal, shown as what changes against the plan the traveller
 * made: added, removed, retimed, moved. Nothing else is implied.
 */
export function ProposalDiff({ proposal, currentRate }: { proposal: Proposal; currentRate: number }) {
  const copy = useGuideHireCopy();
  const { locale } = useLocale();
  const { added, removed, retimed, moved } = proposal.diff;
  const empty = added.length + removed.length + retimed.length + moved.length === 0;
  const rateChanged = proposal.rate_minor !== currentRate;

  return (
    <section
      aria-label={copy.diffTitle}
      className="grid gap-3 rounded-control border border-border-subtle bg-surface p-4 text-sm"
    >
      <h3 className="font-medium">{copy.diffTitle}</h3>
      {empty ? <p className="text-text-muted">{copy.diffNothing}</p> : null}
      <ul className="grid gap-2">
        {added.map((row) => (
          <li key={`add-${row.slug}-${row.position}`} className="flex items-start gap-2 text-success">
            <Plus className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">{copy.diffAdded}: </span>
              {row.title} · {beirutTime(row.starts_at)}–{beirutTime(row.ends_at)}
            </span>
          </li>
        ))}
        {removed.map((row) => (
          <li key={`rm-${row.stop_id}`} className="flex items-start gap-2 text-danger">
            <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-medium">{copy.diffRemoved}: </span>
              <span className="line-through">{row.title}</span>
            </span>
          </li>
        ))}
        {retimed.map((row) => (
          <li key={`time-${row.stop_id}`} className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
            <span>
              <span className="font-medium">{copy.diffRetimed}: </span>
              {row.title} ·{" "}
              <span className="text-text-muted line-through">
                {beirutTime(row.from_starts_at)}–{beirutTime(row.from_ends_at)}
              </span>{" "}
              {beirutTime(row.starts_at)}–{beirutTime(row.ends_at)}
            </span>
          </li>
        ))}
        {moved.map((row) => (
          <li key={`mv-${row.stop_id}`} className="flex items-start gap-2">
            <ArrowRightLeft className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
            <span>
              <span className="font-medium">{copy.diffMoved}: </span>
              {row.title} · {interpolate(copy.diffPosition, { from: String(row.from), to: String(row.to) })}
            </span>
          </li>
        ))}
      </ul>
      {rateChanged ? (
        <p className="font-medium">
          {interpolate(copy.diffRate, { amount: formatCurrency(locale, proposal.rate_minor / 100, "USD") })}
        </p>
      ) : null}
      {proposal.note ? (
        <blockquote className="rounded-control bg-surface-sunken px-3 py-2">
          <span className="font-medium">{copy.diffNote}: </span>
          {proposal.note}
        </blockquote>
      ) : null}
    </section>
  );
}
