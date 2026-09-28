import type { DestinationGuide } from "@/content/destination-guides";
import type { Destination, Experience } from "@/lib/catalog";
import type { Locale } from "@/lib/locale";
import { seoCopy, seoText, type SeoKey } from "@/lib/seo-copy";
import type { Crumb, Faq } from "@/lib/seo/schema";

/**
 * Page copy assembled from catalogue data. Every answer names only places and counts the
 * catalogue returned, so nothing here can drift from what the page shows.
 */

function list(locale: Locale, names: string[]): string {
  return names.join(seoCopy[locale].listJoin);
}

export function crumbsFor(locale: Locale, trail: { key?: SeoKey; name?: string; path: string }[]): Crumb[] {
  return [
    { name: seoText(locale, "crumbHome"), path: "/" },
    ...trail.map((step) => ({ name: step.name ?? seoText(locale, step.key ?? "crumbHome"), path: step.path })),
  ];
}

export function destinationFaqs(locale: Locale, destination: Destination, experiences: Experience[]): Faq[] {
  const values = { name: destination.name, region: destination.region };
  const faqs: Faq[] = [
    {
      question: seoText(locale, "destFaqWhereQ", values),
      answer: seoText(
        locale,
        destination.region === destination.name ? "destFaqWhereRegionA" : "destFaqWhereA",
        values,
      ),
    },
  ];
  if (experiences.length) {
    const total = destination.experienceCount ?? experiences.length;
    faqs.push({
      question: seoText(locale, "destFaqDoQ", values),
      answer: seoText(locale, "destFaqDoA", {
        ...values,
        n: total,
        list: list(
          locale,
          experiences.slice(0, 4).map((item) => item.title),
        ),
      }),
    });
  }
  faqs.push({ question: seoText(locale, "destFaqPlanQ", values), answer: seoText(locale, "planAnswer") });
  return faqs;
}

/** Destinations ranked by how many of the given places they hold. */
export function topDestinations(experiences: Experience[], destinations: Destination[], limit = 5): Destination[] {
  const counts = new Map<string, number>();
  experiences.forEach((item) => counts.set(item.destinationSlug, (counts.get(item.destinationSlug) ?? 0) + 1));
  return destinations
    .filter((destination) => counts.has(destination.slug))
    .sort((a, b) => (counts.get(b.slug) ?? 0) - (counts.get(a.slug) ?? 0))
    .slice(0, limit);
}

export function joinNames(locale: Locale, names: string[]): string {
  return list(locale, names);
}

export type GuideBlock = {
  title: string;
  /** Language of the text: French pages show the English text, marked as English. */
  lang: "en" | "ar";
  paragraphs: string[];
  facts: { label: string; body: string }[];
  advice?: string;
  sourcesLabel: string;
  sources: { label: string; url: string }[];
};

/** The approved editorial guide for a destination, in the page's language. */
export function guideBlock(
  locale: Locale,
  destination: Destination,
  guide: DestinationGuide | undefined,
): GuideBlock | undefined {
  if (!guide) return undefined;
  const lang = locale === "ar" ? "ar" : "en";
  return {
    title: seoText(locale, "guideAbout", { name: destination.name }),
    lang,
    paragraphs: guide.overview[lang],
    facts: [
      { label: seoText(locale, "guideBestTime"), body: guide.bestTime[lang] },
      { label: seoText(locale, "guideGettingThere"), body: guide.gettingThere[lang] },
    ],
    advice: guide.checkAdvice ? seoText(locale, "guideAdvice") : undefined,
    sourcesLabel: seoText(locale, "guideSources"),
    sources: guide.sources,
  };
}

/** Extra questions an approved guide can answer. */
export function guideFaqs(locale: Locale, destination: Destination, guide: DestinationGuide | undefined): Faq[] {
  if (!guide) return [];
  const lang = locale === "ar" ? "ar" : "en";
  const values = { name: destination.name };
  return [
    { question: seoText(locale, "destFaqWhenQ", values), answer: guide.bestTime[lang] },
    { question: seoText(locale, "destFaqHowQ", values), answer: guide.gettingThere[lang] },
  ];
}
