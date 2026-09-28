import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { loadDestinations, loadExperiencePage } from "@/lib/catalogue-api";
import { seoText } from "@/lib/seo-copy";
import { crumbsFor, joinNames, topDestinations } from "@/lib/seo/content";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { breadcrumbSchema, faqSchema, graph, itemListSchema, type Faq } from "@/lib/seo/schema";
import { THINGS, thingBySlug, thingListHref } from "@/lib/seo/things";
import { cn, focusRing } from "@/lib/utils";

export function generateStaticParams() {
  return THINGS.map((item) => ({ category: item.slug }));
}

async function load(slug: string) {
  const thing = thingBySlug(slug);
  if (!thing) return null;
  const [page, destinations] = await Promise.all([
    loadExperiencePage({ ...thing.filter, page: 1, pageSize: 24 }),
    loadDestinations(),
  ]);
  return { thing, page, destinations };
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const data = await load(category);
  if (!data) return { title: "Things to do" };
  const locale = await pathLocale();
  return buildMetadata({
    title: `${seoText(locale, data.thing.title)} — Mshwar`,
    description: seoText(locale, data.thing.intro),
    path: `/things-to-do/${data.thing.slug}`,
    image: data.page.items[0]?.image,
    // An empty landing page is thin content: keep it out of the index until it has places.
    noindex: data.page.items.length === 0,
  });
}

export default async function ThingsToDoCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const [data, locale] = await Promise.all([load(category), pathLocale()]);
  if (!data) notFound();
  const { thing, page, destinations } = data;
  const title = seoText(locale, thing.title);
  const where = topDestinations(page.items, destinations, 8);
  const crumbs = crumbsFor(locale, [
    { key: "crumbThingsToDo", path: "/things-to-do" },
    { name: title, path: `/things-to-do/${thing.slug}` },
  ]);
  const faqs: Faq[] = [];
  if (where.length) {
    faqs.push({
      question: seoText(locale, "catFaqQ", { thing: seoText(locale, thing.name) }),
      answer: seoText(locale, "catFaqA", {
        list: joinNames(
          locale,
          where.slice(0, 4).map((item) => item.name),
        ),
      }),
    });
  }
  faqs.push({ question: seoText(locale, "hubFaqPlanQ"), answer: seoText(locale, "planAnswer") });

  return (
    <ShellMain className="gap-12">
      <JsonLd
        data={graph(itemListSchema(title, page.items, locale), breadcrumbSchema(crumbs, locale), faqSchema(faqs))}
      />
      <Breadcrumbs crumbs={crumbs} label={seoText(locale, "crumbNav")} />
      <PageHeader title={title} description={seoText(locale, thing.intro)} />

      {where.length ? (
        <section aria-labelledby="thing-where" className="grid gap-4">
          <h2 id="thing-where" className="title-card text-[1.4rem]">
            {seoText(locale, "catWhereTitle")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {where.map((item) => (
              <li key={item.slug}>
                <LocaleLink
                  href={`/destinations/${item.slug}`}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border-subtle bg-surface-raised px-4 text-[0.9375rem] font-medium text-text transition-colors hover:border-brand/40 hover:bg-brand-subtle",
                    focusRing,
                  )}
                >
                  <MapPin className="size-4 text-text-muted" strokeWidth={1.75} aria-hidden />
                  {item.name}
                </LocaleLink>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="thing-places" className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="thing-places" className="title-section">
            {seoText(locale, "catPlacesTitle")}
          </h2>
          {page.items.length ? (
            <Button asChild variant="outline">
              <LocaleLink href={thingListHref(thing.slug)}>
                {seoText(locale, "catSeeAll")}
                <ArrowRight className="rtl:-scale-x-100" aria-hidden />
              </LocaleLink>
            </Button>
          ) : null}
        </div>
        {page.items.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {page.items.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} />
            ))}
          </div>
        ) : (
          <p className="text-text-muted">{seoText(locale, "catEmpty")}</p>
        )}
      </section>

      <FaqSection id="thing-faq" title={seoText(locale, "faqHeading")} faqs={faqs} />

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
