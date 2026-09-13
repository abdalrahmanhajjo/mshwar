"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryPills } from "@/components/browse/category-pills";
import { CatalogImage } from "@/components/browse/catalog-image";
import { DestinationCard } from "@/components/browse/destination-card";
import { ExperienceCard } from "@/components/browse/experience-card";
import { HeroSearch } from "@/components/browse/hero-search";
import { PlanSplitCta } from "@/components/browse/plan-cta";
import { useBrowseCopy } from "@/lib/browse-copy";
import { DESTINATIONS, EXPERIENCES, HOME_HERO_IMAGE } from "@/lib/catalog";

export function HomeView() {
  const copy = useBrowseCopy();
  const featured = EXPERIENCES.slice(0, 3);
  const strip = [DESTINATIONS[1], DESTINATIONS[3], DESTINATIONS[4]];

  return (
    <div>
      <section className="relative isolate min-h-[34rem] overflow-hidden md:min-h-[40rem]">
        <CatalogImage src={HOME_HERO_IMAGE} alt="" className="absolute inset-0 h-full w-full" priority />
        <div className="absolute inset-0 bg-brand/35" />
        <div className="shell-frame relative flex min-h-[34rem] flex-col justify-end gap-8 pb-28 pt-24 text-brand-foreground md:min-h-[40rem] md:pb-32">
          <div className="max-w-xl">
            <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">{copy.heroTitle}</h1>
            <p className="mt-4 max-w-md text-sm text-brand-foreground/90 md:text-base">{copy.heroBody}</p>
          </div>
        </div>
        <div className="shell-frame relative z-10 -mt-16 pb-4">
          <HeroSearch />
        </div>
      </section>

      <div className="shell-frame grid gap-16 py-16 md:py-24">
        <p className="text-center text-sm text-text-muted">{copy.lessSearching}</p>

        <section className="grid gap-8">
          <h2 className="text-center text-3xl font-semibold tracking-tight md:text-4xl">{copy.perfectDay}</h2>
          <CategoryPills variant="icons" />
        </section>

        <section className="grid gap-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{copy.goodDays}</h2>
            <Link href="/experiences" className="inline-flex items-center gap-1 text-sm text-text">
              {copy.exploreAll}
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {featured.map((experience) => (
              <ExperienceCard key={experience.slug} experience={experience} />
            ))}
          </div>
        </section>

        <PlanSplitCta />

        <section className="grid gap-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{copy.closeToHome}</h2>
            <Link href="/destinations" className="inline-flex items-center gap-1 text-sm text-text">
              {copy.findPlaceCta}
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
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
