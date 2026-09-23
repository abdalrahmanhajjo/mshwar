"use client";

import * as React from "react";
import { BadgeCheck, Globe, Loader2, MapPin } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { useGuideCopy, type GuideCopy } from "@/lib/guide-copy";
import { fetchGuideDirectory, type PublicGuide } from "@/lib/guides";
import { cn, focusRing } from "@/lib/utils";

export function GuideCard({ guide, copy }: { guide: PublicGuide; copy: GuideCopy }) {
  return (
    <LocaleLink
      href={`/guides/${guide.slug}`}
      className={cn(
        "grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm transition-shadow hover:shadow-md",
        focusRing,
      )}
    >
      <span className="flex flex-wrap items-center gap-2">
        <span className="title-card text-[1.1rem]">{guide.display_name}</span>
        {guide.badge ? (
          <Badge variant="accent" className="gap-1">
            <BadgeCheck className="size-3.5" aria-hidden />
            {copy.badgeLicensed}
          </Badge>
        ) : (
          <Badge variant="outline">{guide.tier === "licensed" ? copy.badgeLicensed : copy.badgeHost}</Badge>
        )}
      </span>
      {guide.headline ? <span className="text-sm text-text-muted">{guide.headline}</span> : null}
      <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
        {guide.regions.length ? (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3 shrink-0" aria-hidden />
            {guide.regions.join(", ")}
          </span>
        ) : null}
        {guide.languages.length ? (
          <span className="inline-flex items-center gap-1">
            <Globe className="size-3 shrink-0" aria-hidden />
            {guide.languages.join(", ")}
          </span>
        ) : null}
      </span>
    </LocaleLink>
  );
}

/** Who is available to run a day with you. Approved guides only. */
export function GuideDirectory({ initial }: { initial?: PublicGuide[] }) {
  const copy = useGuideCopy();
  const [guides, setGuides] = React.useState<PublicGuide[]>(initial ?? []);
  const [loading, setLoading] = React.useState(!initial);

  React.useEffect(() => {
    if (initial) {
      return;
    }
    let cancelled = false;
    void fetchGuideDirectory()
      .then((rows) => {
        if (!cancelled) {
          setGuides(rows);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={copy.kicker} title={copy.directoryTitle} description={copy.directoryBody} />
      {loading ? (
        <div className="grid place-items-center py-16 text-text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : guides.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} copy={copy} />
          ))}
        </div>
      ) : (
        <Notice role="status">{copy.directoryEmpty}</Notice>
      )}
    </div>
  );
}

/** One guide's page - the thing they will share on WhatsApp. */
export function GuidePage({ guide }: { guide: PublicGuide }) {
  const copy = useGuideCopy();
  const facts: [string, string][] = [
    [copy.guideLanguages, guide.languages.join(", ")],
    [copy.guideRegions, guide.regions.join(", ")],
    [copy.guideSpecialities, guide.specialities.join(", ")],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={guide.tier === "licensed" ? copy.badgeLicensed : copy.badgeHost}
        title={guide.display_name}
        description={guide.headline}
      />
      {guide.badge ? (
        <Badge variant="accent" className="w-fit gap-1.5">
          <BadgeCheck className="size-4" aria-hidden />
          {copy.badgeLicensed}
        </Badge>
      ) : null}
      {guide.bio ? <p className="max-w-2xl whitespace-pre-line text-text">{guide.bio}</p> : null}
      {facts.length ? (
        <dl className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="grid gap-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</dt>
              <dd className="text-sm">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
