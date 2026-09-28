import { loadExperiencePage } from "@/lib/catalogue-api";
import type { Locale } from "@/lib/locale";
import type { LinkCard } from "@/components/seo/link-cards";
import { seoText } from "@/lib/seo-copy";
import { THINGS } from "@/lib/seo/things";

/** One card per things-to-do page, pictured by its first real place and labelled with its count. */
export async function thingCards(locale: Locale): Promise<LinkCard[]> {
  const pages = await Promise.all(THINGS.map((thing) => loadExperiencePage({ ...thing.filter, page: 1, pageSize: 1 })));
  return THINGS.map((thing, index) => {
    const page = pages[index];
    return {
      href: `/things-to-do/${thing.slug}`,
      title: seoText(locale, thing.title),
      line: seoText(locale, thing.intro),
      image: page?.items[0]?.image,
      meta: page && page.total > 0 ? seoText(locale, "placesCount", { n: page.total }) : undefined,
    };
  }).filter((_, index) => (pages[index]?.total ?? 0) > 0);
}
