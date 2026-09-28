import type { Metadata } from "next";
import { headers } from "next/headers";
import { resolveImageSrc } from "@/components/browse/catalog-image";
import { DEFAULT_LOCALE, LOCALES, PATH_LOCALE_HEADER, parseLocale, type Locale } from "@/lib/locale";
import { SITE_NAME, SITE_URL, siteUrl } from "@/lib/site";

const OG_LOCALE: Record<Locale, string> = { en: "en_US", ar: "ar_LB", fr: "fr_FR" };

/** The locale the requested URL names (/ar/…, /fr/…), not the visitor's cookie. */
export async function pathLocale(): Promise<Locale> {
  const value = (await headers()).get(PATH_LOCALE_HEADER);
  return value ? parseLocale(value) : DEFAULT_LOCALE;
}

/** An absolute URL for a catalogue image, or undefined when there is none. */
export function absoluteImage(src: string | undefined): string | undefined {
  const resolved = src ? resolveImageSrc(src) : "";
  if (!resolved || resolved.startsWith("data:")) return undefined;
  return new URL(resolved, SITE_URL).toString();
}

/** Search snippets are cut near 155 characters; end on a word, never mid-word. */
export function snippet(text: string | undefined, max = 155): string | undefined {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

export type PageSeo = {
  title: string;
  description?: string;
  /** The page's path without a locale prefix, e.g. "/destinations/byblos". */
  path: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
  /** Keep out of search results (account pages, empty states). Links are still followed. */
  noindex?: boolean;
};

/**
 * One place that turns a page's title, description and path into everything search
 * engines and link previews read: a self-referencing canonical in the URL's own
 * language, hreflang for every language plus x-default, Open Graph and Twitter cards.
 */
export async function buildMetadata(page: PageSeo): Promise<Metadata> {
  const locale = await pathLocale();
  const url = siteUrl(page.path, locale);
  const description = snippet(page.description);
  const image = absoluteImage(page.image);
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((item) => [item, siteUrl(page.path, item)]));
  languages["x-default"] = siteUrl(page.path, DEFAULT_LOCALE);

  return {
    title: page.title,
    description,
    alternates: { canonical: url, languages },
    openGraph: {
      type: page.type ?? "website",
      siteName: SITE_NAME,
      title: page.title,
      description,
      url,
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((item) => item !== locale).map((item) => OG_LOCALE[item]),
      images: image ? [{ url: image, alt: page.imageAlt ?? page.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: page.title,
      description,
      images: image ? [image] : undefined,
    },
    robots: page.noindex ? { index: false, follow: true } : undefined,
  };
}
