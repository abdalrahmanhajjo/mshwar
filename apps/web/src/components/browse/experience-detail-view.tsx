"use client";

import { ArrowLeft, ArrowUpRight, Clock, MapPin } from "lucide-react";
import { BookingWidget } from "@/components/browse/booking-widget";
import { CatalogImage } from "@/components/browse/catalog-image";
import { ExperienceCard } from "@/components/browse/experience-card";
import { SaveExperienceButton } from "@/components/browse/save-button";
import { LocaleLink } from "@/components/shell/locale-link";
import { useBrowseCopy } from "@/lib/browse-copy";
import {
  bookingModeLabel,
  listingAvailabilityNote,
  listingAvailable,
  listingDistance,
  listingGallery,
  listingKind,
  listingPolicies,
  listingRating,
  priceKindLabel,
  type Experience,
} from "@/lib/catalog";
import { CATEGORIES } from "@/lib/catalog";
import { Rating } from "@/components/ui/rating";

export function ExperienceDetailView({ experience, related }: { experience: Experience; related: Experience[] }) {
  const copy = useBrowseCopy();
  const category = CATEGORIES.find((item) => item.slug === experience.category)?.label ?? experience.category;
  const mapsQuery = encodeURIComponent(experience.placeLabel);
  const gallery = listingGallery(experience);
  const policies = listingPolicies(experience);
  const available = listingAvailable(experience);
  const rating = listingRating(experience);
  const kind = listingKind(experience);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": kind === "restaurant" ? "Restaurant" : "TouristAttraction",
            name: experience.title,
            description: experience.body,
            image: gallery,
            url: `/experiences/${experience.slug}`,
            address: {
              "@type": "PostalAddress",
              addressLocality: experience.placeLabel,
              addressCountry: "LB",
            },
            offers: {
              "@type": "Offer",
              priceCurrency: "USD",
              price: experience.priceFrom,
              availability: available ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
              description: `${priceKindLabel(experience.priceLabel)}. ${bookingModeLabel(experience.bookingMode)}.`,
            },
          }),
        }}
      />
      <div className="shell-frame grid gap-4 py-8">
        <LocaleLink href="/experiences" className="inline-flex items-center gap-2 text-sm text-text-muted">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {copy.backExperiences}
        </LocaleLink>
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
          <span>
            {listingDistance(experience)} km {copy.fromBeirut}
          </span>
        </p>
        {rating ? <Rating value={Math.round(rating)} readOnly label={`${rating.toFixed(1)}`} /> : null}
      </div>

      <div className="shell-frame grid gap-3 pb-10 md:grid-cols-3">
        {gallery.map((src, index) => (
          <div
            key={`${src}-${index}`}
            className={index === 0 ? "overflow-hidden rounded-card md:col-span-2" : "overflow-hidden rounded-card"}
          >
            <div className={index === 0 ? "aspect-[16/10]" : "aspect-[4/3]"}>
              <CatalogImage src={src} alt={experience.imageAlt} priority={index === 0} />
            </div>
          </div>
        ))}
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
          <section className="rounded-card border border-border bg-surface-raised p-6">
            <h3 className="font-semibold">{copy.availabilityStatus}</h3>
            <p className="mt-2 text-sm font-medium">
              {bookingModeLabel(experience.bookingMode)} · {copy.preview}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {available ? listingAvailabilityNote(experience) : copy.availabilityUnknown}
            </p>
            <p className="mt-3 text-sm text-text-muted">{priceKindLabel(experience.priceLabel)}</p>
          </section>
          <section aria-labelledby="listing-policies-heading">
            <h3 id="listing-policies-heading" className="font-semibold">
              {copy.policies}
            </h3>
            <ul className="mt-4 grid gap-4">
              {policies.map((policy) => (
                <li key={policy.title}>
                  <p className="text-sm font-medium">{policy.title}</p>
                  <p className="mt-1 text-sm text-text-muted">{policy.body}</p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="font-semibold">{copy.keepExploring.replace(".", "")}</h3>
            <p className="mt-2 text-sm text-text-muted">{copy.noReviews}</p>
          </section>
          <p className="text-sm text-text-muted">{copy.sampleOffer}</p>
        </div>
        <BookingWidget experience={experience} />
      </div>

      <div className="shell-frame grid gap-6 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{copy.keepExploring}</h2>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm"
          >
            {copy.seeArea}
            <ArrowUpRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </a>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {related.map((item) => (
            <ExperienceCard key={item.slug} experience={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
