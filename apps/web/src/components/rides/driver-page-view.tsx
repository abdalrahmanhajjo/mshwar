"use client";

import * as React from "react";
import { ArrowLeft, Car, Loader2, Plane, Star } from "lucide-react";
import { useDisplayNames } from "@/components/guide/pickers";
import { PartnerPhoto, vehicleText } from "@/components/local/driver-card";
import { money, useDay } from "@/components/local/shared";
import { HowBookingWorks } from "@/components/rides/driver-directory";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { TrustBadge, WhatWeChecked } from "@/components/verified/what-we-checked";
import { interpolate } from "@/i18n/catalogues";
import { useLocalCopy } from "@/lib/local-copy";
import { fetchDriverPage, type DriverPage } from "@/lib/rides";

/** /drivers/[slug]: a driver's public page with every check, the cars, and reviews. */
export function DriverPageView({ slug }: { slug: string }) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const names = useDisplayNames();
  const day = useDay();
  const [driver, setDriver] = React.useState<DriverPage | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    void fetchDriverPage(slug)
      .then((next) => {
        if (!cancelled) setDriver(next);
      })
      .catch(() => {
        if (!cancelled) setDriver(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const back = (
    <LocaleLink
      href="/drivers"
      className="inline-flex w-fit items-center gap-2 text-sm text-text-muted hover:text-text"
    >
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {copy.directoryTitle}
    </LocaleLink>
  );
  if (driver === undefined) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (driver === null || !driver.live) {
    return (
      <div className="grid gap-4">
        {back}
        <Notice tone="info" role="status">
          {copy.driverNotListed}
        </Notice>
      </div>
    );
  }

  const rating =
    driver.rating.count > 0 && driver.rating.average !== null
      ? interpolate(copy.ratingLine, {
          avg: driver.rating.average.toLocaleString(locale, { maximumFractionDigits: 1 }),
          count: String(driver.rating.count),
        })
      : copy.newDriver;

  return (
    <div className="grid gap-8">
      {back}
      <header className="flex flex-wrap items-center gap-5">
        <PartnerPhoto url={driver.photo_url} name={driver.display_name} className="size-24" />
        <div className="grid gap-2">
          <h1 className="title-page">{driver.display_name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-text-muted">
            <TrustBadge level={driver.trust.level} />
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-current text-accent-strong" aria-hidden />
              {rating}
            </span>
            {driver.rating.completed_rides ? (
              <span>{interpolate(copy.ridesDone, { n: String(driver.rating.completed_rides) })}</span>
            ) : null}
          </div>
          {driver.headline ? <p>{driver.headline}</p> : null}
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="grid gap-8">
          <WhatWeChecked trust={driver.trust} />
          {driver.bio || driver.languages.length || driver.regions.length ? (
            <section className="grid gap-2">
              <h2 className="title-section text-[1.3rem]">{copy.about}</h2>
              {driver.bio ? <p className="whitespace-pre-line">{driver.bio}</p> : null}
              {driver.languages.length ? (
                <p className="text-sm text-text-muted">
                  {interpolate(copy.speaks, { languages: driver.languages.map(names.language).join(", ") })}
                </p>
              ) : null}
              {driver.regions.length ? (
                <p className="text-sm text-text-muted">{driver.regions.map(names.region).join(" · ")}</p>
              ) : null}
            </section>
          ) : null}
          <section className="grid gap-3">
            <h2 className="title-section text-[1.3rem]">{copy.vehiclesTitle}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {driver.vehicles
                .filter((vehicle) => vehicle.live)
                .map((vehicle) => (
                  <li
                    key={vehicle.id}
                    className="grid gap-1 rounded-card border border-border-subtle bg-surface-raised p-4 text-sm"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <Car className="size-4" aria-hidden />
                      {vehicleText(vehicle, copy.vehicleLine)}
                      {vehicle.year ? <span className="font-normal text-text-muted">({vehicle.year})</span> : null}
                    </span>
                    <span className="text-text-muted">{interpolate(copy.seatsN, { n: String(vehicle.seats) })}</span>
                  </li>
                ))}
            </ul>
          </section>
          <section className="grid gap-3">
            <h2 className="title-section text-[1.3rem]">{copy.reviewsTitle}</h2>
            {driver.reviews.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.noReviews}</p>
            ) : (
              <ul className="grid gap-3">
                {driver.reviews.map((review, index) => (
                  <li
                    key={`${review.at}-${index}`}
                    className="grid gap-1 rounded-card border border-border-subtle p-4 text-sm"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Star className="size-3.5 fill-current text-accent-strong" aria-hidden />
                      {review.rating}/5
                      <span className="font-normal text-text-muted">{day(review.at)}</span>
                    </span>
                    {review.body ? <p className="whitespace-pre-line">{review.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <aside className="grid gap-4 lg:sticky lg:top-24">
          <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm">
            {driver.day_rate_minor ? (
              <p className="text-sm">
                {interpolate(copy.dayRateFrom, { price: money(locale, driver.day_rate_minor) })}
              </p>
            ) : null}
            {driver.airport_pickups ? (
              <p className="flex items-center gap-2 text-sm">
                <Plane className="size-4" aria-hidden />
                {copy.airportYes}
              </p>
            ) : null}
            <Button asChild>
              <LocaleLink href="/rides/new">{copy.askPrice}</LocaleLink>
            </Button>
          </section>
          <HowBookingWorks />
        </aside>
      </div>
    </div>
  );
}
