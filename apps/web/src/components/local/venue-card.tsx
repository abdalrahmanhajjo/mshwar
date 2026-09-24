"use client";

import { ArrowUpRight, BadgeCheck, BedDouble, MessageCircle, Phone, Store, UtensilsCrossed } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { CheckedLine, money, useDay } from "@/components/local/shared";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { interpolate } from "@/i18n/catalogues";
import { useLocalCopy, type LocalKey } from "@/lib/local-copy";
import type { VenueCard } from "@/lib/venues";
import { distanceText } from "@/components/local/changer-list";

function safeUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function whatsappUrl(number: string): string {
  return `https://wa.me/${number.replace(/[^\d]/g, "")}`;
}

/** A checked restaurant or place to stay, with how it was checked and how to reserve. */
export function VenueCardView({ venue }: { venue: VenueCard }) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const day = useDay();
  const stay = venue.kind === "hotel";
  const { details, verification } = venue;
  const level = verification.level;
  const booking = safeUrl(stay ? details.booking_url : details.reservation_url);
  const phone = details.reservation_phone?.trim();
  const whatsapp = details.reservation_whatsapp?.trim();
  const facts = stay
    ? [
        details.stay_type ? copy[`stay_${details.stay_type}` as LocalKey] : null,
        details.stars ? interpolate(copy.starsN, { n: String(details.stars) }) : null,
        details.price_from_minor
          ? interpolate(copy.fromPrice, { price: money(locale, details.price_from_minor, details.currency || "USD") })
          : null,
      ]
    : [
        details.cuisines?.length ? details.cuisines.join(", ") : null,
        details.price_level ? "$".repeat(Math.min(4, Math.max(1, details.price_level))) : null,
      ];

  return (
    <article className="grid overflow-hidden rounded-card border border-border-subtle bg-surface-raised">
      {venue.image ? (
        <div className="relative aspect-[16/9]">
          <CatalogImage src={venue.image} alt={venue.image_alt ?? ""} className="absolute inset-0" />
        </div>
      ) : (
        <div className="grid aspect-[16/9] place-items-center bg-surface-sunken text-text-muted">
          {stay ? (
            <BedDouble className="size-8" strokeWidth={1.4} aria-hidden />
          ) : (
            <UtensilsCrossed className="size-8" strokeWidth={1.4} aria-hidden />
          )}
        </div>
      )}
      <div className="grid gap-3 p-4 md:p-5">
        <div className="grid gap-1">
          <h4 className="font-semibold">{venue.title}</h4>
          {venue.place_label ? <p className="text-sm text-text-muted">{venue.place_label}</p> : null}
          {typeof venue.distance_m === "number" ? (
            <p className="text-sm text-text-muted">{distanceText(venue.distance_m, copy, locale)}</p>
          ) : null}
        </div>
        {level ? (
          <Badge variant="success" className="w-fit">
            {level === "licensed_claimed" ? (
              <Store className="size-3.5" aria-hidden />
            ) : (
              <BadgeCheck className="size-3.5" aria-hidden />
            )}
            {copy[`venue_${level}` as LocalKey]}
          </Badge>
        ) : null}
        {facts.some(Boolean) ? (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-muted">
            {facts.filter(Boolean).map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </p>
        ) : null}
        {venue.summary ? <p className="line-clamp-3 text-sm">{venue.summary}</p> : null}
        {stay && details.check_in && details.check_out ? (
          <p className="text-sm text-text-muted">
            {interpolate(copy.checkInOut, { in: details.check_in.slice(0, 5), out: details.check_out.slice(0, 5) })}
          </p>
        ) : null}
        <div className="grid gap-0.5">
          <CheckedLine checkedOn={verification.checked_on} reviewBy={verification.review_by} />
          {verification.licence?.number ? (
            <p className="text-xs text-text-muted">
              {interpolate(copy.licenceLine, {
                number: verification.licence.number,
                authority: verification.licence.authority,
              })}
              {verification.licence.expires_on ? ` · ${day(verification.licence.expires_on)}` : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {phone ? (
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${phone.replace(/\s+/g, "")}`}>
                <Phone aria-hidden />
                {copy.reserve}
              </a>
            </Button>
          ) : null}
          {whatsapp ? (
            <Button asChild variant="outline" size="sm">
              <a href={whatsappUrl(whatsapp)} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden />
                {copy.whatsapp}
              </a>
            </Button>
          ) : null}
          {booking ? (
            <Button asChild variant="outline" size="sm">
              <a href={booking} target="_blank" rel="noreferrer nofollow">
                {copy.website}
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
              </a>
            </Button>
          ) : null}
          {stay && details.accepts_requests ? (
            <Button asChild size="sm">
              <LocaleLink href={`/experiences/${venue.slug}`}>{copy.askToStay}</LocaleLink>
            </Button>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <LocaleLink href={`/experiences/${venue.slug}`}>{copy.details}</LocaleLink>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
