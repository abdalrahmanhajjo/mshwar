import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeView } from "@/components/browse/home-view";
import { loadDestinations, loadExperiencePage, loadTravellerStories } from "@/lib/catalogue-api";
import { SITE_NAME, SITE_URL, languageAlternates } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mshwar — Lebanon, at your own pace",
  description:
    "Discover real, sourced places across Lebanon and plan a day that fits you — from the cedars to the sea.",
  // Language versions only: one canonical here would mark /ar and /fr as copies of English.
  alternates: { languages: languageAlternates("/") },
};

// Tells search engines the site's name (so results read "Mshwar", not the domain) and
// who runs it. Only facts that are true today: no ratings, prices or social profiles.
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: ["مشوار", "Mshwar Lebanon"],
      url: SITE_URL,
      inLanguage: ["en", "ar", "fr"],
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
  ],
};

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
      <script
        type="application/ld+json"
        // JSON built from constants above; "<" is escaped so the payload cannot close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA).replace(/</g, "\\u003c") }}
      />
      <HomeView
        experiences={page.items.length ? page.items : undefined}
        destinations={destinations.length ? destinations : undefined}
        heroImage={heroImage}
        stories={stories}
      />
    </Suspense>
  );
}
