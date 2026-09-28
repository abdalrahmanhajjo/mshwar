import { LOCALES, withLocalePrefix, type Locale } from "@/lib/locale";

/** The public address search engines should use. Override per deployment with NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://mshwarlb.com").replace(/\/+$/, "");

export const SITE_NAME = "Mshwar";

/** Absolute URL for a path in one locale (English has no prefix; Arabic and French do). */
export function siteUrl(path: string, locale: Locale = "en"): string {
  const localized = withLocalePrefix(locale, path);
  return localized === "/" ? SITE_URL : `${SITE_URL}${localized}`;
}

/** hreflang alternates for a path, keyed the way the sitemap and metadata expect. */
export function languageAlternates(path: string): Record<string, string> {
  return Object.fromEntries(LOCALES.map((locale) => [locale, siteUrl(path, locale)]));
}

/**
 * Pages that are private (accounts, portals, admin), one-time (email links) or behind
 * sign-in. Crawlers are asked to skip them in every locale.
 */
export const PRIVATE_PATHS = [
  "/admin",
  "/business",
  "/drive",
  "/exchange",
  "/guide/",
  "/guides/review",
  "/plan",
  "/trips",
  "/settings",
  "/favorites",
  "/saved",
  "/notifications",
  "/rides/",
  "/join/",
  "/unsubscribe/",
  "/verify-email",
  "/reset-password",
] as const;
