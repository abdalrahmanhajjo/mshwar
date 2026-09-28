import { loadDestinations, loadExperiencePage } from "@/lib/catalogue-api";
import { seoText } from "@/lib/seo-copy";
import { THINGS } from "@/lib/seo/things";
import { SITE_URL, siteUrl } from "@/lib/site";

// Rebuilt every ten minutes, like the sitemap.
export const revalidate = 600;

/**
 * /llms.txt: a plain-language map of the site for AI assistants and answer engines
 * (see llmstxt.org). It says what Mshwar is, how its facts are sourced, and where the
 * canonical page for each destination and kind of day lives. Only real catalogue data.
 */
export async function GET() {
  const [destinations, overview] = await Promise.all([
    loadDestinations().catch(() => []),
    loadExperiencePage({ page: 1, pageSize: 1 }).catch(() => ({ total: 0 })),
  ]);
  const lines = [
    "# Mshwar",
    "",
    "> Mshwar (مشوار) is a Lebanon travel discovery platform: destinations, real places to visit, eat and stay, and a planner that turns chosen places into a day with opening hours and drive times. Available in English, Arabic and French.",
    "",
    `Mshwar lists ${destinations.length} destinations and ${overview.total} places in Lebanon. Every place comes from a named source (official listings or OpenStreetMap, credited on its page). Prices are published or marked "on request", never estimated by AI.`,
    "",
    "## Start here",
    `- [Lebanon travel guide](${siteUrl("/lebanon")}): regions, destinations and ways to spend a day`,
    `- [Destinations](${siteUrl("/destinations")}): every destination with its places`,
    `- [Things to do](${siteUrl("/things-to-do")}): places by kind of day`,
    `- [Plan a trip](${siteUrl("/plan")}): the day planner (sign-in required)`,
    `- [About Mshwar](${siteUrl("/about")}): who runs it and how the information works`,
    "",
    "## Things to do",
    ...THINGS.map((thing) => `- [${seoText("en", thing.title)}](${siteUrl(`/things-to-do/${thing.slug}`)})`),
    "",
    "## Destinations",
    ...destinations.map(
      (item) =>
        `- [${item.name}](${siteUrl(`/destinations/${item.slug}`)})${item.region !== item.name ? ` (${item.region})` : ""}${
          item.blurb ? `: ${item.blurb}` : ""
        }`,
    ),
    "",
    "## Languages",
    `- English: ${SITE_URL}`,
    `- Arabic: ${siteUrl("/", "ar")}`,
    `- French: ${siteUrl("/", "fr")}`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
