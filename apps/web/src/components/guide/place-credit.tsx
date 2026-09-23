"use client";

import { BadgeCheck } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useContributeCopy } from "@/lib/contribute-copy";
import type { PlaceContributor } from "@/lib/guide-contribute";

/** "Added by …" on a place page, linking to the guide who put it on the map. */
export function PlaceCredit({ contributors }: { contributors: PlaceContributor[] }) {
  const copy = useContributeCopy();
  if (!contributors.length) {
    return null;
  }
  return (
    <ul className="grid gap-1 text-sm text-text-muted" aria-label={copy.title}>
      {contributors.map((row) => {
        const template = row.role === "added" ? copy.creditAdded : copy.creditCorrected;
        const [before, after] = template.split("{name}");
        return (
          <li key={`${row.role}-${row.slug}`} className="inline-flex flex-wrap items-center gap-1">
            <BadgeCheck className="size-4 shrink-0" aria-hidden />
            {before}
            <LocaleLink href={`/guides/${row.slug}`} className="font-medium text-text underline">
              {row.display_name}
            </LocaleLink>
            {after}
          </li>
        );
      })}
    </ul>
  );
}
