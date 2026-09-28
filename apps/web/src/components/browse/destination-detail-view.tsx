"use client";

import { ArrowLeft, ArrowUpRight, Clock, Info, MapPin, Route } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { ExperienceCard } from "@/components/browse/experience-card";
import { DestinationServices } from "@/components/local/destination-services";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { Eyebrow, SectionHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Destination, Experience } from "@/lib/catalog";
import type { GuideBlock } from "@/lib/seo/content";
import type { Crumb, Faq } from "@/lib/seo/schema";
import { cn, focusRing } from "@/lib/utils";

export function DestinationDetailView({
  destination,
  experiences,
  crumbs,
  crumbLabel,
  related = [],
  relatedTitle,
  faqs = [],
  faqTitle,
  guide,
}: {
  destination: Destination;
  experiences: Experience[];
  /** Home › Destinations › (region ›) this place; shown in place of a bare back link. */
  crumbs?: Crumb[];
  crumbLabel?: string;
  /** Other destinations in the same region, for readers and for internal links. */
  related?: Destination[];
  relatedTitle?: string;
  /** Questions answered from the catalogue; mirrored in FAQPage data. */
  faqs?: Faq[];
  faqTitle?: string;
  /** The approved editorial overview, when there is one. */
  guide?: GuideBlock;
}) {
  const copy = useBrowseCopy();
  const featured = experiences[0];
  const remainder = experiences.length % 3;
  const ctaSpan = remainder === 0 ? 3 : 3 - remainder;
  const ctaWide = ctaSpan > 1;
  const mapsQuery = encodeURIComponent(`${destination.name}, ${destination.region}, Lebanon`);

  return (
    <div>
      <section className="relative isolate min-h-[30rem] overflow-hidden bg-brand md:min-h-[38rem]">
        <CatalogImage src={destination.image} alt={destination.imageAlt} className="absolute inset-0" priority />
        <div className="photo-scrim-side absolute inset-0" />
        <div className="photo-scrim absolute inset-0 opacity-60" />
        <div className="shell-frame relative flex min-h-[30rem] flex-col justify-end gap-5 pb-14 pt-24 text-white md:min-h-[38rem] md:pb-20">
          {crumbs ? (
            <Breadcrumbs crumbs={crumbs} label={crumbLabel ?? ""} tone="inverse" className="mb-4" />
          ) : (
            <LocaleLink
              href="/destinations"
              className={cn(
                "mb-4 inline-flex w-fit items-center gap-2 rounded-sm text-sm text-white/90 hover:text-white",
                focusRing,
              )}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              {copy.backDestinations}
            </LocaleLink>
          )}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
            {destination.region} · {destination.country}
          </p>
          <h1 className="title-hero max-w-3xl">
            {destination.name}, <span className="text-serif block">{copy.atYourOwnPace}</span>
          </h1>
        </div>
      </section>

      <div className="shell-frame grid gap-12 py-16 md:py-20 lg:grid-cols-[1.35fr_1fr] lg:items-start lg:gap-20">
        <div className="grid gap-5">
          <Eyebrow>{copy.destinationIntroKicker}</Eyebrow>
          <h2 className="title-page max-w-xl text-balance">{copy.destinationIntroTitle}</h2>
          <p className="max-w-xl text-lg leading-relaxed text-text-muted">{destination.blurb}</p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label={copy.tagsLabel}>
            {destination.tags.map((tag) => (
              <li key={tag} className="rounded-pill bg-brand-subtle px-3.5 py-1.5 text-sm font-medium text-text">
                {tag}
              </li>
            ))}
          </ul>
        </div>
        <aside className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-8">
          <h2 className="title-card text-[1.4rem]">{copy.planVisit}</h2>
          <ul className="grid gap-4 text-[0.9375rem]">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 size-5 shrink-0 text-text-muted" strokeWidth={1.6} aria-hidden />
              {destination.name}, {destination.region}
            </li>
            {featured ? (
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 size-5 shrink-0 text-text-muted" strokeWidth={1.6} aria-hidden />
                {copy.sampleExperience} · {featured.hours} {copy.hoursLabel}
              </li>
            ) : null}
            <li className="flex items-start gap-3 text-text-muted">
              <Info className="mt-0.5 size-5 shrink-0" strokeWidth={1.6} aria-hidden />
              {copy.hoursAccess}
            </li>
          </ul>
          <Button asChild variant="outline" size="lg" className="w-full">
            <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer">
              {copy.openMaps}
              <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
            </a>
          </Button>
        </aside>
      </div>

      {guide ? (
        <section
          aria-labelledby="destination-guide"
          lang={guide.lang}
          className="shell-frame grid gap-10 pb-20 lg:grid-cols-[1.35fr_1fr] lg:gap-20"
        >
          <div className="grid content-start gap-5">
            <h2 id="destination-guide" className="title-section">
              {guide.title}
            </h2>
            {guide.paragraphs.map((paragraph) => (
              <p key={paragraph} className="max-w-2xl text-[1.0625rem] leading-relaxed text-text-muted">
                {paragraph}
              </p>
            ))}
            {guide.sources.length ? (
              <p className="text-sm text-text-muted">
                {guide.sourcesLabel}:{" "}
                {guide.sources.map((source, index) => (
                  <span key={source.url}>
                    {index ? " · " : null}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn("underline underline-offset-4 hover:text-text", focusRing)}
                    >
                      {source.label}
                    </a>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
          <dl className="grid content-start gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 md:p-8">
            {guide.facts.map((fact) => (
              <div key={fact.label} className="grid gap-1.5">
                <dt className="font-semibold text-text">{fact.label}</dt>
                <dd className="leading-relaxed text-text-muted">{fact.body}</dd>
              </div>
            ))}
            {guide.advice ? (
              <p className="border-t border-border-subtle pt-4 text-sm text-text-muted">{guide.advice}</p>
            ) : null}
          </dl>
        </section>
      ) : null}

      {featured ? (
        <div className="shell-frame grid gap-8 pb-20">
          <SectionHeader eyebrow={copy.makeADayKicker} title={`${copy.makeADay} ${destination.name}.`} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {experiences.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} />
            ))}
            <div
              className={cn(
                "flex flex-col justify-between gap-8 rounded-card bg-surface-sunken p-8 md:p-10",
                ctaSpan === 2 && "lg:col-span-2",
                ctaSpan === 3 && "sm:col-span-2 lg:col-span-3",
                ctaWide && "lg:flex-row lg:items-center",
              )}
            >
              <span className="grid size-12 place-items-center rounded-full bg-surface-raised text-text shadow-sm">
                <Route className="size-5" strokeWidth={1.6} aria-hidden />
              </span>
              <div className={cn("grid gap-3", ctaWide && "lg:flex-1")}>
                <h3 className="title-section text-[1.9rem]">{copy.oneStop}</h3>
                <p className="text-text-muted">{copy.oneStopBody}</p>
              </div>
              <Button asChild className="w-fit">
                <LocaleLink href={`/plan?add=${featured.slug}`}>
                  {copy.startPlan}
                  <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
                </LocaleLink>
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <DestinationServices slug={destination.slug} name={destination.name} />

      {related.length || faqs.length ? (
        <div className="shell-frame grid gap-16 pb-20">
          {related.length ? (
            <section aria-labelledby="related-destinations" className="grid gap-5">
              <h2 id="related-destinations" className="title-section">
                {relatedTitle}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {related.map((item) => (
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
          <FaqSection id="destination-faq" title={faqTitle ?? ""} faqs={faqs} />
        </div>
      ) : null}
    </div>
  );
}
