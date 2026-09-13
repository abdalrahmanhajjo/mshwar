export const LOCALES = ["en", "ar", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_COOKIE = "mshwar-locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ar: "العربية",
  fr: "Français",
};

export const LOCALE_SHORT_LABELS: Record<Locale, string> = {
  en: "EN",
  ar: "AR",
  fr: "FR",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: string | undefined | null, fallback: Locale = "en"): Locale {
  return isLocale(value) ? value : fallback;
}

export function localeDirection(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

export function applyDocumentLocale(locale: Locale) {
  if (typeof document === "undefined") {
    return;
  }
  const direction = localeDirection(locale);
  document.documentElement.lang = locale;
  document.documentElement.dir = direction;
  document.documentElement.setAttribute("data-locale", locale);
}
