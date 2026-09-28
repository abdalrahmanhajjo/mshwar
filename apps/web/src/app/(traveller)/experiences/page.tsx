import type { Metadata } from "next";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { seoText } from "@/lib/seo-copy";
import { Suspense } from "react";
import { ExperiencesSkeleton } from "@/components/browse/experiences-skeleton";
import { ExperiencesView } from "@/components/browse/experiences-view";
import { loadExperiencePage, loadMapListings } from "@/lib/catalogue-api";
import { parseExperienceFilters } from "@/lib/catalog";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pathLocale();
  return buildMetadata({
    title: seoText(locale, "experiencesTitle"),
    description: seoText(locale, "experiencesDescription"),
    path: "/experiences",
  });
}

export default async function ExperiencesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseExperienceFilters(params);
  const page = await loadExperiencePage(filters);
  const mapItems = filters.view === "map" ? await loadMapListings(filters) : page.items;

  return (
    <Suspense fallback={<ExperiencesSkeleton />}>
      <ExperiencesView filters={filters} page={page} mapItems={mapItems} />
    </Suspense>
  );
}
