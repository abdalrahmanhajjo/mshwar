"use client";

import { ArrowUpRight, MapPin } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { CategoryPills } from "@/components/browse/category-pills";
import { CatalogImage } from "@/components/browse/catalog-image";
import { DestinationCard } from "@/components/browse/destination-card";
import { ExperienceCard } from "@/components/browse/experience-card";
import { HeroSearch } from "@/components/browse/hero-search";
import { PlanSplitCta } from "@/components/browse/plan-cta";
import { useLocale } from "@/components/shell/locale-provider";
import { useBrowseCopy } from "@/lib/browse-copy";
import { DESTINATIONS, EXPERIENCES, HOME_HERO_IMAGE } from "@/lib/catalog";

export function HomeView() {
  const copy = useBrowseCopy();
  const { locale } = useLocale();
  const featured = EXPERIENCES.slice(0, 3);
  const strip = [DESTINATIONS[1], DESTINATIONS[3], DESTINATIONS[4]];

  return (
    <div className="home-view">
      <section className="home-hero">
        <div className="home-hero-photo">
          <CatalogImage src={HOME_HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full" priority />
          <div className="home-hero-shade" />
          <div className="home-hero-content">
            <div className="home-hero-text">
              <p className="mb-4 text-[0.6rem] uppercase tracking-[0.24em] text-brand-foreground/80">
                Small country. Endless possibilities.
              </p>
              <h1 className="home-title">
                {locale === "en" ? <>Make room for<br />a little <em>mshwar.</em></> : copy.heroTitle}
              </h1>
              <p className="mt-4 max-w-md text-sm text-brand-foreground/90 md:text-base">{locale === "en" ? <>From the mountains to the Mediterranean.<br />Find your kind of day, all in one place.</> : copy.heroBody}</p>
              <LocaleLink
                href="/plan"
                className="mt-6 inline-flex items-center gap-2 text-sm text-brand-foreground underline-offset-4 hover:underline"
              >
                {locale === "en" ? "Let’s plan something good" : copy.buildTrip}
                <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
              </LocaleLink>
            </div>
          </div>
          <p className="home-location"><MapPin size={13} aria-hidden /> Byblos, Mount Lebanon <span>34.1230° N, 35.6480° E</span></p>
        </div>
        <div className="home-search">
          <HeroSearch />
        </div>
      </section>

      <div className="home-sections">
        <div className="home-motto">
          <p className="font-serif text-base italic text-text md:text-lg">{copy.lessSearching}</p>
          <p className="hidden max-w-xs text-end text-xs leading-relaxed text-text-muted md:block">
            Local places. Thoughtful plans. Your own pace.
          </p>
        </div>

        <section className="grid gap-6">
          <div>
            <p className="mb-3 text-[0.6rem] uppercase tracking-[0.24em] text-text-muted">Follow your curiosity</p>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{copy.perfectDay}</h2>
          </div>
          <CategoryPills variant="icons" />
        </section>

        <section className="grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-3 text-[0.6rem] uppercase tracking-[0.24em] text-text-muted">A little inspiration</p>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{copy.goodDays}</h2>
            </div>
            <LocaleLink href="/experiences" className="inline-flex items-center gap-1 text-sm text-text">
              {copy.exploreAll}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </LocaleLink>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {featured.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} />
            ))}
          </div>
          <p className="text-xs text-text-muted">{locale === "en" ? "* Illustrative prices. Availability is not live." : copy.sampleDisclaimer}</p>
        </section>

        <PlanSplitCta />

        <section className="grid gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-3 text-[0.6rem] uppercase tracking-[0.24em] text-text-muted">A different side of Lebanon</p>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{copy.closeToHome}</h2>
            </div>
            <LocaleLink href="/destinations" className="inline-flex items-center gap-1 text-sm text-text">
              {copy.findPlaceCta}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
            </LocaleLink>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {strip.map((destination) => (
              <DestinationCard key={destination.slug} destination={destination} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
