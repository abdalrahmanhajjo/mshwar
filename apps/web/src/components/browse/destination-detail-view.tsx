"use client";

import Link from "next/link";
import { ArrowLeft, Clock, MapPin } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Destination, Experience } from "@/lib/catalog";

export function DestinationDetailView({
  destination,
  experiences,
}: {
  destination: Destination;
  experiences: Experience[];
}) {
  const copy = useBrowseCopy();
  const featured = experiences[0];
  const mapsQuery = encodeURIComponent(`${destination.name}, ${destination.region}, Lebanon`);

  return (
    <div>
      <section className="relative isolate min-h-[28rem] overflow-hidden md:min-h-[34rem]">
        <CatalogImage src={destination.image} alt={destination.imageAlt} className="absolute inset-0" priority />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/20 to-transparent" />
        <div className="shell-frame relative flex min-h-[28rem] flex-col justify-end pb-10 pt-24 md:min-h-[34rem]">
          <Link href="/destinations" className="mb-6 inline-flex items-center gap-2 text-sm text-text">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {copy.backDestinations}
          </Link>
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
            {destination.region} · {destination.country}
          </p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
            {destination.name}, at your own pace.
          </h1>
        </div>
      </section>

      <div className="shell-frame grid gap-10 py-12 md:grid-cols-[1.3fr_0.9fr] md:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{copy.destinationIntroKicker}</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">{copy.destinationIntroTitle}</h2>
          <p className="mt-4 max-w-xl text-text-muted">{destination.blurb}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {destination.tags.map((tag) => (
              <span key={tag} className="rounded-pill border border-border bg-surface-raised px-3 py-1 text-sm">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="grid gap-4 p-6">
            <h3 className="text-title font-semibold">{copy.planVisit}</h3>
            <p className="text-sm text-text-muted">
              <MapPin className="me-1 inline size-4" aria-hidden />
              {destination.name}, {destination.region}
            </p>
            {featured ? (
              <p className="text-sm text-text-muted">
                <Clock className="me-1 inline size-4" aria-hidden />
                {copy.experiences} · {featured.hours} {copy.hoursLabel}
              </p>
            ) : null}
            <p className="text-sm text-text-muted">{copy.hoursAccess}</p>
            <Button asChild variant="outline" className="rounded-pill">
              <a href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`} target="_blank" rel="noreferrer">
                {copy.openMaps}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      {featured ? (
        <div className="shell-frame grid gap-8 pb-16">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            {copy.makeADay} {destination.name}.
          </h2>
          <div className="grid overflow-hidden rounded-card bg-surface-sunken md:grid-cols-[14rem_1fr]">
            <div className="aspect-[4/3] md:aspect-auto">
              <CatalogImage src={featured.image} alt={featured.imageAlt} />
            </div>
            <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
              <p className="text-xs text-text-muted">{featured.placeLabel}</p>
              <h3 className="text-3xl font-semibold tracking-tight">{copy.oneStop}</h3>
              <p className="text-sm text-text-muted">{copy.oneStopBody}</p>
              <div>
                <Button asChild className="rounded-pill">
                  <Link href={`/plan?add=${featured.slug}`}>{copy.startPlan}</Link>
                </Button>
              </div>
              <Link href={`/experiences/${featured.slug}`} className="text-sm underline-offset-4 hover:underline">
                {featured.title}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
