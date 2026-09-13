"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Clock, MapPin } from "lucide-react";
import { BookingWidget } from "@/components/browse/booking-widget";
import { CatalogImage } from "@/components/browse/catalog-image";
import { ExperienceCard } from "@/components/browse/experience-card";
import { SaveExperienceButton } from "@/components/browse/save-button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { bookingModeLabel, type Experience } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/catalog";

export function ExperienceDetailView({ experience, related }: { experience: Experience; related: Experience[] }) {
  const copy = useBrowseCopy();
  const category = CATEGORIES.find((item) => item.slug === experience.category)?.label ?? experience.category;
  const mapsQuery = encodeURIComponent(experience.placeLabel);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TouristAttraction",
            name: experience.title,
            description: experience.body,
            image: experience.image,
            url: `/experiences/${experience.slug}`,
          }),
        }}
      />
      <div className="shell-frame grid gap-4 py-8">
        <Link href="/experiences" className="inline-flex items-center gap-2 text-sm text-text-muted">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {copy.backExperiences}
        </Link>
        <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
          {category} · {experience.placeLabel}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-5xl">{experience.title}</h1>
          <SaveExperienceButton slug={experience.slug} />
        </div>
        <p className="flex flex-wrap gap-4 text-sm text-text-muted">
          <span>
            <MapPin className="me-1 inline size-4" aria-hidden />
            {experience.placeLabel}
          </span>
          <span>
            <Clock className="me-1 inline size-4" aria-hidden />
            {experience.hours} {copy.hoursLabel}
          </span>
        </p>
      </div>

      <div className="shell-frame grid gap-6 pb-10 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="overflow-hidden rounded-card">
          <div className="aspect-[16/10]">
            <CatalogImage src={experience.image} alt={experience.imageAlt} priority />
          </div>
        </div>
        <div className="flex flex-col justify-between rounded-card bg-brand p-8 text-brand-foreground">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-brand-foreground/70">{experience.placeLabel}</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">{experience.summary}</h2>
            <p className="mt-3 text-sm text-brand-foreground/80">{experience.tags.join(" · ")}</p>
          </div>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-2 text-sm"
          >
            {copy.seeArea}
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </div>
      </div>

      <div className="shell-frame grid gap-10 pb-16 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
        <div className="grid gap-8">
          <section>
            <h2 className="text-3xl font-semibold tracking-tight">{experience.body.split(".")[0]}.</h2>
            <p className="mt-4 text-text-muted">{experience.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {experience.tags.map((tag) => (
                <span key={tag} className="rounded-pill border border-border px-3 py-1 text-sm">
                  {tag}
                </span>
              ))}
            </div>
          </section>
          <section className="grid gap-6 md:grid-cols-2">
            {experience.facts.map((fact) => (
              <div key={fact.title}>
                <h3 className="font-semibold">{fact.title}</h3>
                <p className="mt-2 text-sm text-text-muted">{fact.body}</p>
              </div>
            ))}
          </section>
          <section>
            <h3 className="font-semibold">{copy.keepExploring.replace(".", "")}</h3>
            <p className="mt-2 text-sm text-text-muted">{copy.noReviews}</p>
          </section>
          <p className="text-sm text-text-muted">{copy.sampleOffer}</p>
          <p className="text-sm font-medium">
            {bookingModeLabel(experience.bookingMode)} · {copy.preview}
          </p>
        </div>
        <BookingWidget experience={experience} />
      </div>

      <div className="shell-frame grid gap-6 pb-16">
        <h2 className="text-3xl font-semibold tracking-tight">{copy.keepExploring}</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {related.map((item) => (
            <ExperienceCard key={item.slug} experience={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
