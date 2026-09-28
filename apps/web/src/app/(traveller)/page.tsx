import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeView } from "@/components/browse/home-view";
import { loadDestinations, loadExperiencePage, loadTravellerStories } from "@/lib/catalogue-api";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { seoText } from "@/lib/seo-copy";
import { graph, organizationSchema, websiteSchema } from "@/lib/seo/schema";
import { JsonLd } from "@/components/seo/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pathLocale();
  return buildMetadata({
    title: seoText(locale, "homeTitle"),
    description: seoText(locale, "homeDescription"),
    path: "/",
  });
}

const HERO_SLUGS = ["baalbek", "baalbek-hermel"];

export default async function Home() {
  // Real catalogue data when the API answers; HomeView falls back to the bundled
  // sample when a list is empty, so the page is never blank.
  const [page, destinations] = await Promise.all([loadExperiencePage({ page: 1, pageSize: 8 }), loadDestinations()]);
  // Traveller stories come only from published reviews of verified bookings.
  const stories = await loadTravellerStories(page.items);
  // The hero always shows Baalbek: the catalogue's Baalbek cover when it has one,
  // otherwise the bundled Baalbek photo (HomeView's default).
  const heroImage =
    HERO_SLUGS.map((slug) => destinations.find((item) => item.slug === slug)?.image).find(Boolean) || undefined;

  return (
    <Suspense>
      <JsonLd data={graph(websiteSchema(), organizationSchema())} />
      <HomeView
        experiences={page.items.length ? page.items : undefined}
        destinations={destinations.length ? destinations : undefined}
        heroImage={heroImage}
        stories={stories}
      />
    </Suspense>
  );
}
