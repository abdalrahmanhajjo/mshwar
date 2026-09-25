"use client";

import { ArrowUpRight, MapPin } from "lucide-react";
import { CheckedLine } from "@/components/local/shared";
import { Button } from "@/components/ui/button";
import type { DestinationServiceSource } from "@/lib/destination-service-sources";
import { useLocalCopy, type LocalKey } from "@/lib/local-copy";

/** Public-source referrals never inherit the partner verification/booking badge. */
export function SourceList({ entries }: { entries: DestinationServiceSource[] }) {
  const copy = useLocalCopy();
  if (!entries.length) return null;
  return (
    <div className="grid gap-4">
      <p className="max-w-3xl text-sm text-text-muted">{copy.sourceScope}</p>
      <div className="grid gap-4 md:grid-cols-2">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="grid content-start gap-3 rounded-card border border-border-subtle bg-surface-raised p-5"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {copy[`sourceType_${entry.service_type}` as LocalKey]}
            </p>
            <h3 className="font-semibold">{entry.name}</h3>
            <p className="flex items-start gap-2 text-sm text-text-muted">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              {entry.locality}
            </p>
            {entry.coverage !== "local" ? (
              <p className="text-sm">{copy[`sourceCoverage_${entry.coverage}` as LocalKey]}</p>
            ) : null}
            {entry.category === "money" ? <p className="text-sm">{copy.sourceMoneyNote}</p> : null}
            <p className="text-xs text-text-muted">
              {entry.source_kind === "operator" ? copy.sourceOperator : copy.sourceDirectory} · {entry.source_name}
            </p>
            <CheckedLine checkedOn={entry.checked_on} reviewBy={entry.review_by} />
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={entry.source_url} target="_blank" rel="noreferrer nofollow">
                {copy.sourceLink}
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
              </a>
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
