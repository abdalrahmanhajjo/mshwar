import type { MetadataRoute } from "next";
import { loadCollections, loadDestinations, loadExperiencePage } from "@/lib/catalogue-api";
import { LOCALES } from "@/lib/locale";
import { THINGS } from "@/lib/seo/things";
import { languageAlternates, siteUrl } from "@/lib/site";

// Rebuilt every ten minutes, so new catalogue entries (and the first real data after a
// deploy, whose build has no API to read) appear without another deploy.
export const revalidate = 600;

type Entry = { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" | "yearly" };

// The main sections, in the order the site's own navigation gives them. Search engines
// read this order and the internal links together when choosing sitelinks.
const SECTIONS: Entry[] = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/lebanon", priority: 0.95, changeFrequency: "weekly" },
  { path: "/destinations", priority: 0.9, changeFrequency: "weekly" },
  { path: "/experiences", priority: 0.9, changeFrequency: "daily" },
  { path: "/things-to-do", priority: 0.9, changeFrequency: "weekly" },
  ...THINGS.map((thing) => ({
    path: `/things-to-do/${thing.slug}`,
    priority: 0.85,
    changeFrequency: "weekly" as const,
  })),
  { path: "/ideas", priority: 0.8, changeFrequency: "weekly" },
  { path: "/collections", priority: 0.7, changeFrequency: "weekly" },
  { path: "/discover", priority: 0.7, changeFrequency: "weekly" },
  { path: "/drivers", priority: 0.7, changeFrequency: "weekly" },
  { path: "/guides", priority: 0.6, changeFrequency: "weekly" },
  { path: "/about", priority: 0.5, changeFrequency: "yearly" },
  { path: "/partners", priority: 0.3, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  { path: "/signup", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cancellation-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/community-guidelines", priority: 0.3, changeFrequency: "yearly" },
];

// The catalogue API caps a page at 48 listings.
const PAGE_SIZE = 48;
const MAX_PAGES = 40;

async function experienceSlugs(): Promise<string[]> {
  const slugs = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await loadExperiencePage({ page, pageSize: PAGE_SIZE });
    const before = slugs.size;
    result.items.forEach((item) => slugs.add(item.slug));
    // Stop at the last page, or as soon as a page adds nothing new.
    if (page >= result.pages || slugs.size === before) break;
  }
  return [...slugs];
}

function expand(entries: Entry[]): MetadataRoute.Sitemap {
  // One <url> per locale, each listing all three language versions (hreflang).
  return entries.flatMap((entry) =>
    LOCALES.map((locale) => ({
      url: siteUrl(entry.path, locale),
      changeFrequency: entry.changeFrequency,
      priority: entry.priority,
      alternates: { languages: languageAlternates(entry.path) },
    })),
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only real catalogue data is listed; when the API is down these come back empty
  // (the bundled sample is never offered to search engines as real places).
  const [destinations, experiences, collections] = await Promise.all([
    loadDestinations().catch(() => []),
    experienceSlugs().catch(() => []),
    loadCollections().catch(() => []),
  ]);

  return expand([
    ...SECTIONS,
    ...destinations.map((item) => ({
      path: `/destinations/${item.slug}`,
      priority: 0.8,
      changeFrequency: "weekly" as const,
    })),
    ...experiences.map((slug) => ({ path: `/experiences/${slug}`, priority: 0.7, changeFrequency: "weekly" as const })),
    ...collections.map((item) => ({
      path: `/collections/${item.slug}`,
      priority: 0.6,
      changeFrequency: "weekly" as const,
    })),
  ]);
}
