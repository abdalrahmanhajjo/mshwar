"use client";

import * as React from "react";
import { ArrowUpRight, BedDouble, Car, UtensilsCrossed } from "lucide-react";
import { useDestinations } from "@/components/guide/pickers";
import { distanceText } from "@/components/local/changer-list";
import { CheckedLine } from "@/components/local/shared";
import { fareText, modeLabel } from "@/components/local/transport-card";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import type { Experience } from "@/lib/catalog";
import { useLocalCopy } from "@/lib/local-copy";
import { fetchTransportBetween, type TransportCard } from "@/lib/transport";
import { fetchVenuesNear, type VenueCard } from "@/lib/venues";

type Leg = { from: Experience; to: Experience };

/** Consecutive stops in different destinations: the legs a traveller has to get across. */
export function crossings(picks: Experience[]): Leg[] {
  const legs: Leg[] = [];
  for (let index = 1; index < picks.length; index += 1) {
    const from = picks[index - 1];
    const to = picks[index];
    if (from && to && from.destinationSlug && to.destinationSlug && from.destinationSlug !== to.destinationSlug) {
      legs.push({ from, to });
    }
  }
  return legs;
}

function LegRow({ leg, names }: { leg: Leg; names: Map<string, string> }) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const [cards, setCards] = React.useState<TransportCard[] | null>(null);
  const fromSlug = leg.from.destinationSlug;
  const toSlug = leg.to.destinationSlug;
  const fromName = names.get(fromSlug) ?? leg.from.placeLabel;
  const toName = names.get(toSlug) ?? leg.to.placeLabel;

  React.useEffect(() => {
    let cancelled = false;
    void fetchTransportBetween(fromSlug, toSlug)
      .then((next) => {
        if (!cancelled) setCards(next);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fromSlug, toSlug]);

  const ask = new URLSearchParams({ destination: fromSlug, pickup: leg.from.title, dropoff: leg.to.title });

  return (
    <li className="grid gap-2 rounded-control border border-border-subtle p-3 text-sm">
      <p className="font-medium">
        {fromName}{" "}
        <span aria-hidden className="inline-block rtl:rotate-180">
          →
        </span>{" "}
        {toName}
      </p>
      {cards === null ? null : cards.length === 0 ? (
        <p className="text-text-muted">{interpolate(copy.legNone, { from: fromName, to: toName })}</p>
      ) : (
        <ul className="grid gap-1.5">
          {cards.slice(0, 3).map((card) => (
            <li key={card.id} className="grid gap-0.5">
              <span>
                <span className="font-medium">{modeLabel(card.mode, copy)}</span>
                {card.line_name ? ` · ${card.line_name}` : ""}
                {fareText(card, copy, locale) ? ` · ${fareText(card, copy, locale)}` : ""}
              </span>
              {card.pickup.name ? (
                <span className="text-text-muted">{interpolate(copy.pickupAt, { place: card.pickup.name })}</span>
              ) : null}
              <CheckedLine checkedOn={card.checked_on} reviewBy={card.review_by} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <LocaleLink
          href={`/rides/new?${ask.toString()}`}
          className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          <Car className="size-3.5" aria-hidden />
          {copy.legAskDriver}
        </LocaleLink>
        <LocaleLink
          href={`/destinations/${toSlug}#getting-there`}
          className="inline-flex items-center gap-1 text-text-muted underline-offset-4 hover:underline"
        >
          {interpolate(copy.legAllTransport, { name: toName })}
          <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
        </LocaleLink>
      </div>
    </li>
  );
}

/** Under a day's stops: checked ways to get between destinations, with a verified-driver fallback. */
export function LegTransport({ picks }: { picks: Experience[] }) {
  const copy = useLocalCopy();
  const destinations = useDestinations();
  const names = React.useMemo(() => new Map(destinations.map((row) => [row.slug, row.name])), [destinations]);
  const legs = crossings(picks);
  if (legs.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-2">
      <h4 className="text-sm font-semibold">{copy.legTitle}</h4>
      <ul className="grid gap-2">
        {legs.map((leg) => (
          <LegRow key={`${leg.from.slug}-${leg.to.slug}`} leg={leg} names={names} />
        ))}
      </ul>
    </div>
  );
}

function VenueLine({ venue }: { venue: VenueCard }) {
  const { locale } = useLocale();
  const copy = useLocalCopy();
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3">
      <LocaleLink href={`/experiences/${venue.slug}`} className="font-medium underline-offset-4 hover:underline">
        {venue.title}
      </LocaleLink>
      {typeof venue.distance_m === "number" ? (
        <span className="text-xs text-text-muted">{distanceText(venue.distance_m, copy, locale)}</span>
      ) : null}
    </li>
  );
}

/** Checked restaurants and stays near the day's last stop, where a traveller eats and sleeps. */
export function NearbyVenues({ pick }: { pick: Experience | undefined }) {
  const copy = useLocalCopy();
  const [venues, setVenues] = React.useState<{ key: string; eat: VenueCard[]; stay: VenueCard[] } | null>(null);
  const lat = pick?.lat;
  const lng = pick?.lng;
  const key = lat !== undefined && lng !== undefined ? `${lat},${lng}` : "";

  React.useEffect(() => {
    if (lat === undefined || lng === undefined) {
      return;
    }
    let cancelled = false;
    void Promise.all([fetchVenuesNear("restaurant", lat, lng), fetchVenuesNear("hotel", lat, lng)])
      .then(([eat, stay]) => {
        if (!cancelled) setVenues({ key: `${lat},${lng}`, eat: eat.slice(0, 3), stay: stay.slice(0, 3) });
      })
      .catch(() => {
        if (!cancelled) setVenues({ key: `${lat},${lng}`, eat: [], stay: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (!pick || !key || venues?.key !== key) {
    return null;
  }
  const empty = venues.eat.length === 0 && venues.stay.length === 0;
  return (
    <div className="grid gap-2 text-sm">
      <h4 className="font-semibold">{interpolate(copy.nearbyTitle, { place: pick.title })}</h4>
      {empty ? (
        <p className="text-text-muted">{copy.nearbyNone}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {venues.eat.length ? (
            <div className="grid gap-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                <UtensilsCrossed className="size-3.5" aria-hidden />
                {copy.nearbyEat}
              </p>
              <ul className="grid gap-1">
                {venues.eat.map((venue) => (
                  <VenueLine key={venue.id} venue={venue} />
                ))}
              </ul>
            </div>
          ) : null}
          {venues.stay.length ? (
            <div className="grid gap-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                <BedDouble className="size-3.5" aria-hidden />
                {copy.nearbyStay}
              </p>
              <ul className="grid gap-1">
                {venues.stay.map((venue) => (
                  <VenueLine key={venue.id} venue={venue} />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
