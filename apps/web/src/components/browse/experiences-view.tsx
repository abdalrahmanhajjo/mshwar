"use client";

import { useRouter } from "next/navigation";
import { LocaleLink } from "@/components/shell/locale-link";
import { CategoryPills } from "@/components/browse/category-pills";
import { ExperienceCard } from "@/components/browse/experience-card";
import { FilterRail } from "@/components/browse/filter-rail";
import { HeroSearch } from "@/components/browse/hero-search";
import { SoftPlanCta } from "@/components/browse/plan-cta";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { withLocalePrefix } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";
import { ExperiencesMap } from "@/components/browse/experiences-map";
import {
  DESTINATIONS,
  LISTING_KINDS,
  serializeExperienceFilters,
  type Experience,
  type ExperienceFilters,
  type ExperiencePage,
} from "@/lib/catalog";

export function ExperiencesView({
  filters,
  page,
  mapItems,
}: {
  filters: ExperienceFilters;
  page: ExperiencePage;
  mapItems: Experience[];
}) {
  const copy = useBrowseCopy();
  const { locale } = useLocale();
  const router = useRouter();

  function pushFilters(next: ExperienceFilters) {
    const query = serializeExperienceFilters(next);
    router.push(withLocalePrefix(locale, query ? `/experiences?${query}` : "/experiences"));
  }

  function patch(partial: Partial<ExperienceFilters>) {
    pushFilters({ ...filters, ...partial });
  }

  const activeChips = [
    filters.q ? { key: "q", label: filters.q } : null,
    filters.category && filters.category !== "all" ? { key: "category", label: filters.category } : null,
    filters.destination
      ? {
          key: "destination",
          label: DESTINATIONS.find((item) => item.slug === filters.destination)?.name ?? filters.destination,
        }
      : null,
    filters.kind && filters.kind !== "all" ? { key: "kind", label: filters.kind } : null,
    filters.date ? { key: "date", label: filters.date } : null,
    filters.priceMax ? { key: "priceMax", label: `$${filters.priceMax}` } : null,
    filters.distance ? { key: "distance", label: `${filters.distance} km` } : null,
    filters.party ? { key: "party", label: String(filters.party) } : null,
    filters.rating ? { key: "rating", label: `${filters.rating}+` } : null,
    filters.available ? { key: "available", label: copy.availableOnly } : null,
  ].filter(Boolean) as { key: keyof ExperienceFilters; label: string }[];

  return (
    <div className="shell-frame grid gap-8 py-12 md:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{copy.browseEyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{copy.browseTitle}</h1>
        <p className="mt-4 text-text-muted">{copy.browseBody}</p>
      </header>

      <HeroSearch initialQuery={filters.q ?? ""} compact />

      <div className="flex flex-wrap justify-center gap-2">
        {LISTING_KINDS.map((kind) => {
          const active = (filters.kind ?? "all") === kind.slug;
          return (
            <Button
              key={kind.slug}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="rounded-pill"
              onClick={() => patch({ kind: kind.slug === "all" ? undefined : kind.slug, page: 1 })}
            >
              {kind.slug === "all"
                ? copy.kindAll
                : kind.slug === "experience"
                  ? copy.kindExperiences
                  : kind.slug === "attraction"
                    ? copy.kindAttractions
                    : copy.kindRestaurants}
            </Button>
          );
        })}
      </div>

      <CategoryPills active={filters.category ?? "all"} />

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr] lg:items-start">
        <FilterRail filters={filters} onChange={patch} />
        <div className="grid gap-6">
          {activeChips.length ? (
            <div className="flex flex-wrap items-center gap-2">
              {activeChips.map((chip) => (
                <span key={chip.key} className="rounded-pill bg-surface-sunken px-3 py-1 text-sm">
                  {chip.label}
                </span>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push(withLocalePrefix(locale, "/experiences"))}
              >
                {copy.clearFilters}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              {page.total} {copy.placesCount}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={filters.view === "map" ? "outline" : "default"}
                onClick={() => patch({ view: undefined })}
              >
                {copy.listView}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filters.view === "map" ? "default" : "outline"}
                onClick={() => patch({ view: "map" })}
              >
                {copy.mapView}
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-text-muted">{copy.recommended}</span>
              <select
                className="rounded-control border border-border bg-surface-raised px-3 py-2"
                value={filters.sort ?? "recommended"}
                onChange={(event) =>
                  patch({ sort: event.target.value === "recommended" ? undefined : event.target.value, page: 1 })
                }
                aria-label={copy.recommended}
              >
                <option value="recommended">{copy.sortRecommended}</option>
                <option value="price">{copy.sortPrice}</option>
                <option value="duration">{copy.sortDuration}</option>
                <option value="rating">{copy.sortRating}</option>
              </select>
            </label>
          </div>

          {filters.view === "map" ? (
            <ExperiencesMap items={mapItems} onSearchArea={(destination) => patch({ destination, page: 1 })} />
          ) : page.items.length ? (
            <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
              {page.items.map((experience) => (
                <ExperienceCard key={experience.slug} experience={experience} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={copy.emptyResults}
              action={
                <Button type="button" onClick={() => router.push(withLocalePrefix(locale, "/experiences"))}>
                  {copy.clearFilters}
                </Button>
              }
            />
          )}

          {page.pages > 1 ? (
            <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page.page <= 1}
                onClick={() => patch({ page: page.page - 1 })}
              >
                {copy.pagePrevious}
              </Button>
              <p className="text-sm text-text-muted">
                {page.page} / {page.pages}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page.page >= page.pages}
                onClick={() => patch({ page: page.page + 1 })}
              >
                {copy.pageNext}
              </Button>
            </nav>
          ) : null}
        </div>
      </div>

      <SoftPlanCta />
      <p className="text-center text-sm">
        <LocaleLink href="/ideas" className="underline-offset-4 hover:underline">
          {copy.ideasTitle}
        </LocaleLink>
      </p>
    </div>
  );
}
