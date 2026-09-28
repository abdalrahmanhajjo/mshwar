import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { LinkCards } from "@/components/seo/link-cards";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { loadDestinations, loadExperiencePage } from "@/lib/catalogue-api";
import type { Destination } from "@/lib/catalog";
import { seoText } from "@/lib/seo-copy";
import { crumbsFor, joinNames } from "@/lib/seo/content";
import { thingCards } from "@/lib/seo/hub-data";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { ORGANIZATION_ID, breadcrumbSchema, faqSchema, graph, type Faq } from "@/lib/seo/schema";
import { siteUrl } from "@/lib/site";
import { cn, focusRing } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pathLocale();
  return buildMetadata({
    title: seoText(locale, "hubTitle"),
    description: seoText(locale, "hubDescription"),
    path: "/lebanon",
    type: "article",
  });
}

/** Governorates with the towns the catalogue files under them. */
function byRegion(destinations: Destination[]) {
  const regions = destinations.filter((item) => item.region === item.name);
  const grouped = regions.map((region) => ({
    region,
    towns: destinations.filter((item) => item.region === region.name && item.slug !== region.slug),
  }));
  const placed = new Set(grouped.flatMap((group) => [group.region.slug, ...group.towns.map((town) => town.slug)]));
  return { grouped, rest: destinations.filter((item) => !placed.has(item.slug)) };
}

const pill = cn(
  "inline-flex min-h-10 items-center rounded-pill border border-border-subtle bg-surface-raised px-3.5 text-sm font-medium text-text transition-colors hover:border-brand/40 hover:bg-brand-subtle",
  focusRing,
);

/**
 * The pillar page for "Lebanon travel": a direct answer first (what AI overviews quote),
 * then every region and destination, the ways to spend a day, real places, and the
 * questions people ask — all linked, so each deeper page is one click away.
 */
export default async function LebanonGuidePage() {
  const locale = await pathLocale();
  const [destinations, overview, cards] = await Promise.all([
    loadDestinations(),
    loadExperiencePage({ page: 1, pageSize: 6 }),
    thingCards(locale),
  ]);
  const { grouped, rest } = byRegion(destinations);
  const busiest = [...destinations]
    .filter((item) => (item.experienceCount ?? 0) > 0)
    .sort((a, b) => (b.experienceCount ?? 0) - (a.experienceCount ?? 0))
    .slice(0, 5);
  const crumbs = crumbsFor(locale, [{ key: "crumbGuide", path: "/lebanon" }]);
  const faqs: Faq[] = [
    ...(busiest.length
      ? [
          {
            question: seoText(locale, "hubFaqSeeQ"),
            answer: seoText(locale, "hubFaqSeeA", {
              list: joinNames(
                locale,
                busiest.map((item) => item.name),
              ),
            }),
          },
        ]
      : []),
    { question: seoText(locale, "hubFaqPlanQ"), answer: seoText(locale, "planAnswer") },
    { question: seoText(locale, "hubFaqLangQ"), answer: seoText(locale, "hubFaqLangA") },
    { question: seoText(locale, "hubFaqCapitalQ"), answer: seoText(locale, "hubFaqCapitalA") },
  ];
  const answer = seoText(locale, "hubAnswer", { destinations: destinations.length, places: overview.total });

  return (
    <ShellMain className="gap-14">
      <JsonLd
        data={graph(
          {
            "@type": "Article",
            headline: seoText(locale, "hubH1"),
            description: answer,
            url: siteUrl("/lebanon", locale),
            inLanguage: locale,
            about: { "@type": "Country", name: "Lebanon" },
            publisher: { "@id": ORGANIZATION_ID },
            mentions: destinations.slice(0, 30).map((item) => ({
              "@type": "TouristDestination",
              name: item.name,
              url: siteUrl(`/destinations/${item.slug}`, locale),
            })),
          },
          breadcrumbSchema(crumbs, locale),
          faqSchema(faqs),
        )}
      />
      <div className="grid gap-6">
        <Breadcrumbs crumbs={crumbs} label={seoText(locale, "crumbNav")} />
        <h1 className="title-page max-w-3xl text-balance">{seoText(locale, "hubH1")}</h1>
        {/* The direct answer: one paragraph a reader, or an AI overview, can quote on its own. */}
        <p className="max-w-3xl text-lg leading-relaxed text-text-muted">{answer}</p>
      </div>

      <section aria-labelledby="hub-regions" className="grid gap-6">
        <h2 id="hub-regions" className="title-section">
          {seoText(locale, "hubRegionsTitle")}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {grouped.map(({ region, towns }) => (
            <div key={region.slug} className="grid content-start gap-3 rounded-card border border-border-subtle p-5">
              <h3 className="text-lg font-semibold">
                <LocaleLink
                  href={`/destinations/${region.slug}`}
                  className={cn("rounded-sm hover:underline", focusRing)}
                >
                  {region.name}
                </LocaleLink>
              </h3>
              {region.blurb ? <p className="text-sm leading-relaxed text-text-muted">{region.blurb}</p> : null}
              {towns.length ? (
                <ul className="flex flex-wrap gap-2">
                  {towns.map((town) => (
                    <li key={town.slug}>
                      <LocaleLink href={`/destinations/${town.slug}`} className={pill}>
                        {town.name}
                      </LocaleLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
        {rest.length ? (
          <ul className="flex flex-wrap gap-2">
            {rest.map((item) => (
              <li key={item.slug}>
                <LocaleLink href={`/destinations/${item.slug}`} className={pill}>
                  {item.name}
                </LocaleLink>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {cards.length ? (
        <section aria-labelledby="hub-things" className="grid gap-6">
          <h2 id="hub-things" className="title-section">
            {seoText(locale, "hubThingsTitle")}
          </h2>
          <LinkCards cards={cards} />
        </section>
      ) : null}

      {overview.items.length ? (
        <section aria-labelledby="hub-places" className="grid gap-6">
          <h2 id="hub-places" className="title-section">
            {seoText(locale, "hubPlacesTitle")}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {overview.items.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} />
            ))}
          </div>
        </section>
      ) : null}

      <FaqSection id="hub-faq" title={seoText(locale, "faqHeading")} faqs={faqs} />

      <section className="grid gap-4 rounded-card bg-surface-sunken p-8 md:p-10">
        <h2 className="title-section">{seoText(locale, "hubPlanTitle")}</h2>
        <p className="max-w-xl text-text-muted">{seoText(locale, "hubPlanBody")}</p>
        <Button asChild className="w-fit">
          <LocaleLink href="/plan">
            {seoText(locale, "hubPlanCta")}
            <ArrowRight className="rtl:-scale-x-100" aria-hidden />
          </LocaleLink>
        </Button>
      </section>
    </ShellMain>
  );
}
