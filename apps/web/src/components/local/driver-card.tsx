"use client";

import { Car, Plane, Star, UserRound } from "lucide-react";
import { money } from "@/components/local/shared";
import { useDisplayNames } from "@/components/guide/pickers";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { TrustBadge } from "@/components/verified/what-we-checked";
import { interpolate } from "@/i18n/catalogues";
import { useLocalCopy } from "@/lib/local-copy";
import type { DriverCard } from "@/lib/rides";
import type { Vehicle } from "@/lib/partners";
import { cn, focusRing } from "@/lib/utils";

export function PartnerPhoto({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not an optimisable asset
    <img src={url} alt={name} className={cn("size-14 shrink-0 rounded-full object-cover", className)} />
  ) : (
    <span
      aria-hidden
      className={cn("grid size-14 shrink-0 place-items-center rounded-full bg-brand-subtle text-text", className)}
    >
      <UserRound className="size-6" strokeWidth={1.6} />
    </span>
  );
}

export function vehicleText(vehicle: Pick<Vehicle, "colour" | "make" | "model">, template: string): string {
  return interpolate(template, { colour: vehicle.colour, make: vehicle.make, model: vehicle.model }).trim();
}

/** A verified driver in a list: face, checks level, rating, languages and the car. */
export function DriverCardView({ driver }: { driver: DriverCard }) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const names = useDisplayNames();
  const vehicle = driver.vehicles.find((item) => item.live) ?? driver.vehicles[0];
  const rating =
    driver.rating.count > 0 && driver.rating.average !== null
      ? interpolate(copy.ratingLine, {
          avg: driver.rating.average.toLocaleString(locale, { maximumFractionDigits: 1 }),
          count: String(driver.rating.count),
        })
      : copy.newDriver;

  return (
    <LocaleLink
      href={`/drivers/${driver.slug}`}
      aria-label={interpolate(copy.viewDriver, { name: driver.display_name })}
      className={cn(
        "grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 transition-colors hover:border-border md:p-5",
        focusRing,
      )}
    >
      <div className="flex items-start gap-3">
        <PartnerPhoto url={driver.photo_url} name={driver.display_name} />
        <div className="grid min-w-0 flex-1 gap-1">
          <p className="truncate font-semibold">{driver.display_name}</p>
          <TrustBadge level={driver.trust.level} className="w-fit" />
          <p className="flex items-center gap-1 text-sm text-text-muted">
            <Star className="size-3.5 fill-current text-accent-strong" aria-hidden />
            {rating}
            {driver.rating.completed_rides ? (
              <span> · {interpolate(copy.ridesDone, { n: String(driver.rating.completed_rides) })}</span>
            ) : null}
          </p>
        </div>
      </div>
      {driver.headline ? <p className="text-sm">{driver.headline}</p> : null}
      <ul className="grid gap-1 text-sm text-text-muted">
        {driver.languages.length ? (
          <li>{interpolate(copy.speaks, { languages: driver.languages.map(names.language).join(", ") })}</li>
        ) : null}
        {vehicle ? (
          <li className="flex items-center gap-1.5">
            <Car className="size-3.5" aria-hidden />
            {vehicleText(vehicle, copy.vehicleLine)} · {interpolate(copy.seatsN, { n: String(vehicle.seats) })}
          </li>
        ) : null}
        {driver.airport_pickups ? (
          <li className="flex items-center gap-1.5">
            <Plane className="size-3.5" aria-hidden />
            {copy.airportYes}
          </li>
        ) : null}
        {driver.day_rate_minor ? (
          <li>{interpolate(copy.dayRateFrom, { price: money(locale, driver.day_rate_minor) })}</li>
        ) : null}
      </ul>
    </LocaleLink>
  );
}
