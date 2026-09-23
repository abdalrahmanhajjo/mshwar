"use client";

import * as React from "react";
import { BadgeCheck, Globe, Loader2, MapPin, Search, X } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { useDisplayNames } from "@/components/guide/pickers";
import { interpolate } from "@/i18n/catalogues";
import { useGuideCopy, type GuideCopy } from "@/lib/guide-copy";
import { fetchGuideDirectory, type PublicGuide } from "@/lib/guides";
import { matchesQuery } from "@/lib/place-search";
import { useSearchCopy } from "@/lib/search-copy";
import { cn, focusRing } from "@/lib/utils";

export type GuideFilter = { query: string; region: string; language: string };

/** Narrow the directory by name (or headline and specialities), area and language. */
export function filterGuides(guides: PublicGuide[], filter: GuideFilter): PublicGuide[] {
  return guides.filter(
    (guide) =>
      matchesQuery(filter.query, guide.display_name, guide.headline, ...guide.specialities) &&
      (!filter.region || guide.regions.includes(filter.region)) &&
      (!filter.language || guide.languages.includes(filter.language)),
  );
}

export function GuideCard({ guide, copy }: { guide: PublicGuide; copy: GuideCopy }) {
  const names = useDisplayNames();
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
            {guide.regions.map(names.region).join(", ")}
          </span>
        ) : null}
        {guide.languages.length ? (
          <span className="inline-flex items-center gap-1">
            <Globe className="size-3 shrink-0" aria-hidden />
            {guide.languages.map(names.language).join(", ")}
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
  const search = useSearchCopy();
  const names = useDisplayNames();
  const [filter, setFilter] = React.useState<GuideFilter>({ query: "", region: "", language: "" });
  const shown = filterGuides(guides, filter);
  const regions = [...new Set(guides.flatMap((guide) => guide.regions))].sort((a, b) =>
    names.region(a).localeCompare(names.region(b)),
  );
  const languages = [...new Set(guides.flatMap((guide) => guide.languages))].sort((a, b) =>
    names.language(a).localeCompare(names.language(b)),
  );
  const filtered = Boolean(filter.query || filter.region || filter.language);

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
        <div className="grid gap-5">
          <div
            role="search"
            className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 sm:grid-cols-[1fr_12rem_12rem]"
          >
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <Input
                type="search"
                aria-label={search.guideSearch}
                placeholder={search.guideSearch}
                value={filter.query}
                className="ps-10"
                onChange={(event) => setFilter((prev) => ({ ...prev, query: event.target.value }))}
              />
            </div>
            <NativeSelect
              aria-label={search.regionFilter}
              value={filter.region}
              onChange={(event) => setFilter((prev) => ({ ...prev, region: event.target.value }))}
            >
              <option value="">{search.allRegions}</option>
              {regions.map((slug) => (
                <option key={slug} value={slug}>
                  {names.region(slug)}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect
              aria-label={search.languageFilter}
              value={filter.language}
              onChange={(event) => setFilter((prev) => ({ ...prev, language: event.target.value }))}
            >
              <option value="">{search.allLanguages}</option>
              {languages.map((code) => (
                <option key={code} value={code}>
                  {names.language(code)}
                </option>
              ))}
            </NativeSelect>
          </div>
          {filtered ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
              <span role="status">{interpolate(search.resultCount, { n: String(shown.length) })}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFilter({ query: "", region: "", language: "" })}
              >
                <X aria-hidden />
                {search.clearFilters}
              </Button>
            </div>
          ) : null}
          {shown.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((guide) => (
                <GuideCard key={guide.slug} guide={guide} copy={copy} />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Search aria-hidden />} title={search.noGuides} />
          )}
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
  const names = useDisplayNames();
  const facts: [string, string][] = [
    [copy.guideLanguages, guide.languages.map(names.language).join(", ")],
    [copy.guideRegions, guide.regions.map(names.region).join(", ")],
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
