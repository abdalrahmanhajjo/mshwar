import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeView } from "@/components/browse/home-view";
import { loadDestinations, loadExperiencePage } from "@/lib/catalogue-api";

export const metadata: Metadata = {
  title: "Mshwar — Make room for a little mshwar",
  description: "From the mountain air to the sea, find your next day at your own pace.",
};

const HERO_SLUGS = ["baalbek", "baalbek-hermel"];

export default async function Home() {
  // Real catalogue data when the API answers; HomeView falls back to the bundled
  // sample when a list is empty, so the page is never blank.
  const [page, destinations] = await Promise.all([loadExperiencePage({ page: 1, pageSize: 6 }), loadDestinations()]);
  // The hero always shows Baalbek: the catalogue's Baalbek cover when it has one,
  // otherwise the bundled Baalbek photo (HomeView's default).
  const heroImage =
    HERO_SLUGS.map((slug) => destinations.find((item) => item.slug === slug)?.image).find(Boolean) || undefined;

  return (
    <Suspense>
      <HomeView
        experiences={page.items.length ? page.items : undefined}
        destinations={destinations.length ? destinations : undefined}
        heroImage={heroImage}
      />
    </Suspense>
  );
}
