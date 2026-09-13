"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CategoryPills } from "@/components/browse/category-pills";
import { ExperienceCard } from "@/components/browse/experience-card";
import { HeroSearch } from "@/components/browse/hero-search";
import { SoftPlanCta } from "@/components/browse/plan-cta";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { DESTINATIONS, filterExperiences } from "@/lib/catalog";

export function ExperiencesView() {
  const copy = useBrowseCopy();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "all";
  const destination = params.get("destination") ?? "";
  const sort = params.get("sort") ?? "recommended";
  const results = useMemo(
    () => filterExperiences({ q, category, destination, sort }),
    [q, category, destination, sort],
  );

  const activeChips = [
    q ? { key: "q", label: q } : null,
    category !== "all" ? { key: "category", label: category } : null,
    destination
      ? { key: "destination", label: DESTINATIONS.find((item) => item.slug === destination)?.name ?? destination }
      : null,
  ].filter(Boolean) as { key: string; label: string }[];

  function clearAll() {
    router.push(pathname);
  }

  function setSort(next: string) {
    const search = new URLSearchParams(params.toString());
    if (next === "recommended") {
      search.delete("sort");
    } else {
      search.set("sort", next);
    }
    const query = search.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="shell-frame grid gap-8 py-12 md:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{copy.browseEyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{copy.browseTitle}</h1>
        <p className="mt-4 text-text-muted">{copy.browseBody}</p>
      </header>

      <HeroSearch initialQuery={q} compact />
      <CategoryPills active={category} />

      {activeChips.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <span key={chip.key} className="rounded-pill bg-surface-sunken px-3 py-1 text-sm">
              {chip.label}
            </span>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            {copy.clearFilters}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          {results.length} {copy.placesCount}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-text-muted">{copy.recommended}</span>
          <select
            className="rounded-control border border-border bg-surface-raised px-3 py-2"
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label={copy.recommended}
          >
            <option value="recommended">{copy.sortRecommended}</option>
            <option value="price">{copy.sortPrice}</option>
            <option value="duration">{copy.sortDuration}</option>
          </select>
        </label>
      </div>

      {results.length ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((experience) => (
            <ExperienceCard key={experience.slug} experience={experience} />
          ))}
        </div>
      ) : (
        <EmptyState title={copy.emptyResults} action={<Button onClick={clearAll}>{copy.clearFilters}</Button>} />
      )}

      <SoftPlanCta />
    </div>
  );
}
