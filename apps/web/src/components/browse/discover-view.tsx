"use client";

import Link from "next/link";
import { DestinationCard } from "@/components/browse/destination-card";
import { ExperienceCard } from "@/components/browse/experience-card";
import { SoftPlanCta } from "@/components/browse/plan-cta";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { DESTINATIONS, EXPERIENCES, IDEAS, listingKind } from "@/lib/catalog";

export function DiscoverView() {
  const copy = useBrowseCopy();
  const experiences = EXPERIENCES.filter((item) => listingKind(item) === "experience").slice(0, 3);
  const attractions = EXPERIENCES.filter((item) => listingKind(item) === "attraction");
  const restaurants = EXPERIENCES.filter((item) => listingKind(item) === "restaurant");

  return (
    <div className="shell-frame grid gap-16 py-12 md:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{copy.browseEyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{copy.discoverTitle}</h1>
        <p className="mt-4 text-text-muted">{copy.discoverBody}</p>
      </header>

      <section className="grid gap-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{copy.destinations}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/destinations">{copy.exploreAll}</Link>
          </Button>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATIONS.slice(0, 3).map((destination) => (
            <DestinationCard key={destination.slug} destination={destination} />
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{copy.kindExperiences}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/experiences?kind=experience">{copy.exploreAll}</Link>
          </Button>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {experiences.map((experience) => (
            <ExperienceCard key={experience.slug} experience={experience} />
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{copy.kindAttractions}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/experiences?kind=attraction">{copy.exploreAll}</Link>
          </Button>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {attractions.map((experience) => (
            <ExperienceCard key={experience.slug} experience={experience} />
          ))}
        </div>
      </section>

      <section className="grid gap-6">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{copy.kindRestaurants}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/experiences?kind=restaurant">{copy.exploreAll}</Link>
          </Button>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {restaurants.map((experience) => (
            <ExperienceCard key={experience.slug} experience={experience} />
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-card bg-surface-sunken p-8">
        <h2 className="text-3xl font-semibold tracking-tight">{copy.ideasTitle}</h2>
        <p className="text-text-muted">{copy.ideasBody}</p>
        <ul className="grid gap-2 text-sm">
          {IDEAS.map((idea) => (
            <li key={idea.slug}>
              <Link href={`/experiences/${idea.experienceSlugs[0]}`} className="underline-offset-4 hover:underline">
                {idea.title}
              </Link>
            </li>
          ))}
        </ul>
        <div>
          <Button asChild className="rounded-pill">
            <Link href="/ideas">{copy.exploreDay}</Link>
          </Button>
        </div>
      </section>

      <SoftPlanCta />
    </div>
  );
}
