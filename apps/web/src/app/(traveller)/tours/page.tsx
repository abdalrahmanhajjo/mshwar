import type { Metadata } from "next";
import { List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { TourCardView } from "@/components/tours/tour-card";
import { ToursMap } from "@/components/tours/tours-map";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { loadTours, type TourFilters } from "@/lib/guides-server";
import { withLocalePrefix } from "@/lib/locale";
import { languageName } from "@/lib/place-search";
import { seoText } from "@/lib/seo-copy";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { breadcrumbSchema, graph, organizationSchema, tourListSchema } from "@/lib/seo/schema";
import { toursCopy, toursText } from "@/lib/tours-copy";
import { cn, controlSize, focusRing } from "@/lib/utils";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTER_KEYS = ["q", "destination", "language", "date", "max_duration", "max_price", "instant", "sort"] as const;
const LANGUAGES = ["en", "ar", "fr", "es", "it", "de"];
const SORTS = ["recommended", "price", "duration", "soonest"] as const;

function pick(params: Record<string, string | string[] | undefined>): TourFilters & { view?: string } {
  const out: Record<string, string> = {};
  for (const key of [...FILTER_KEYS, "view"]) {
    const value = params[key];
    const text = Array.isArray(value) ? value[0] : value;
    if (text && text.length <= 80) out[key] = text;
  }
  if (out.max_price) out.max_price = String(Math.round(Number(out.max_price) * 100) || "");
  if (out.sort && !SORTS.includes(out.sort as (typeof SORTS)[number])) delete out.sort;
  if (out.date && !/^\d{4}-\d{2}-\d{2}$/.test(out.date)) delete out.date;
  return out;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await pathLocale();
  const params = await searchParams;
  const filtered = FILTER_KEYS.some((key) => params[key]);
  return buildMetadata({
    title: toursText(locale, "metaTitle"),
    description: toursText(locale, "metaDescription"),
    path: "/tours",
    // One indexable list; filtered variants are for people, not for search results.
    noindex: filtered,
  });
}

const field = cn("w-full rounded-control border border-border-subtle bg-surface px-3", controlSize, focusRing);

export default async function ToursPage({ searchParams }: { searchParams: SearchParams }) {
  const locale = await pathLocale();
  const copy = toursCopy[locale];
  const raw = await searchParams;
  const filters = pick(raw);
  const { view, ...query } = filters;
  const result = await loadTours(query);
  const crumbs = [
    { name: seoText(locale, "crumbHome"), path: "/" },
    { name: copy.crumbTours, path: "/tours" },
  ];
  const value = (key: string) => {
    const item = raw[key];
    return (Array.isArray(item) ? item[0] : item) ?? "";
  };
  const withView = (next: string) => {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      if (value(key)) params.set(key, value(key));
    }
    if (next === "map") params.set("view", "map");
    const text = params.toString();
    return text ? `/tours?${text}` : "/tours";
  };

  return (
    <ShellMain className="gap-8">
      <JsonLd
        data={graph(
          organizationSchema(),
          breadcrumbSchema(crumbs, locale),
          result ? tourListSchema(copy.title, result.tours, locale) : null,
        )}
      />
      <header className="grid gap-3">
        <Breadcrumbs crumbs={crumbs} label={seoText(locale, "crumbNav")} />
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent-strong">{copy.kicker}</p>
        <h1 className="title-page text-[clamp(2rem,5vw,3rem)]">{copy.title}</h1>
        <p className="max-w-2xl text-lg text-text-muted">{copy.body}</p>
      </header>

      <form
        method="get"
        action={withLocalePrefix(locale, "/tours")}
        className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-sm md:grid-cols-4 lg:grid-cols-8"
      >
        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          {copy.search}
          <input name="q" defaultValue={value("q")} placeholder={copy.searchPlaceholder} className={field} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {copy.destination}
          <select name="destination" defaultValue={value("destination")} className={field}>
            <option value="">{copy.anyDestination}</option>
            {(result?.destinations ?? [])
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((destination) => (
                <option key={destination.slug} value={destination.slug}>
                  {destination.name}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {copy.date}
          <input type="date" name="date" defaultValue={value("date")} className={field} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {copy.language}
          <select name="language" defaultValue={value("language")} className={field}>
            <option value="">{copy.anyLanguage}</option>
            {LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {languageName(code, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {copy.duration}
          <select name="max_duration" defaultValue={value("max_duration")} className={field}>
            <option value="">{copy.anyDuration}</option>
            <option value="120">{copy.upTo2h}</option>
            <option value="240">{copy.upTo4h}</option>
            <option value="720">{copy.upToDay}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {copy.maxPrice}
          <input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            name="max_price"
            defaultValue={value("max_price")}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          {copy.sort}
          <select name="sort" defaultValue={value("sort") || "recommended"} className={field}>
            {SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {copy[`sort${sort}`]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 md:col-span-4 lg:col-span-8">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="instant"
              value="true"
              defaultChecked={value("instant") === "true"}
              className="size-4 accent-brand"
            />
            {copy.instantOnly}
          </label>
          <span className="flex flex-wrap gap-2">
            <LocaleLink
              href="/tours"
              className={cn("rounded-control px-4 py-2 text-sm font-medium text-text-muted hover:text-text", focusRing)}
            >
              {copy.reset}
            </LocaleLink>
            <button
              type="submit"
              className={cn(
                "inline-flex items-center gap-2 rounded-control bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand/90",
                focusRing,
              )}
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              {copy.apply}
            </button>
          </span>
        </div>
      </form>

      {!result ? (
        <Notice tone="warning">{copy.unavailable}</Notice>
      ) : (
        <section aria-labelledby="results-title" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="results-title" className="text-lg font-semibold">
              {result.total === 1 ? copy.resultsOne : interpolate(copy.results, { n: String(result.total) })}
            </h2>
            <nav className="inline-flex rounded-pill border border-border-subtle p-1" aria-label={copy.mapView}>
              <LocaleLink
                href={withView("list")}
                aria-current={view !== "map" ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm",
                  view !== "map" ? "bg-brand text-brand-foreground" : "text-text-muted",
                  focusRing,
                )}
              >
                <List className="size-4" aria-hidden />
                {copy.listView}
              </LocaleLink>
              <LocaleLink
                href={withView("map")}
                aria-current={view === "map" ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm",
                  view === "map" ? "bg-brand text-brand-foreground" : "text-text-muted",
                  focusRing,
                )}
              >
                <MapIcon className="size-4" aria-hidden />
                {copy.mapView}
              </LocaleLink>
            </nav>
          </div>
          {view === "map" && result.tours.length ? <ToursMap tours={result.tours} /> : null}
          {result.tours.length === 0 ? (
            <p className="rounded-card border border-dashed border-border-subtle p-8 text-center text-text-muted">
              {copy.empty}
            </p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.tours.map((tour) => (
                <TourCardView key={tour.slug} tour={tour} copy={copy} locale={locale} />
              ))}
            </ul>
          )}
        </section>
      )}
    </ShellMain>
  );
}
