"use client";

import { LocaleLink } from "@/components/shell/locale-link";
import { ArrowRight, Clock, MapPin, Star, Users } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { SaveExperienceButton } from "@/components/browse/save-button";
import { BidiText } from "@/components/ui/bidi-text";
import { useBrowseCopy } from "@/lib/browse-copy";
import { useHomeCopy } from "@/lib/home-copy";
import { useLocale } from "@/components/shell/locale-provider";
import { formatCurrency, formatNumber } from "@/i18n/format";
import { interpolate } from "@/i18n/catalogues";
import type { Experience } from "@/lib/catalog";
import { useMoodLabel } from "@/components/home/moods";
import { cn, focusRing } from "@/lib/utils";

/**
 * A marketplace listing: the photo leads, then where, what, how long, for how
 * many, and what it costs. A rating shows only when real reviews produced one.
 */
export function ExperienceCard({ experience, compact = false }: { experience: Experience; compact?: boolean }) {
  const copy = useBrowseCopy();
  const home = useHomeCopy();
  const moodLabel = useMoodLabel();
  const { locale } = useLocale();
  const category = moodLabel(experience.category);
  const [place, region] = experience.placeLabel.split(" · ");
  const rating = typeof experience.rating === "number" && experience.rating > 0 ? experience.rating : null;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[1.125rem] border border-border-subtle bg-surface-raised transition-[border-color,box-shadow] duration-200 hover:border-brand/25 hover:shadow-[0_14px_30px_-22px_rgb(18_53_47/0.45)]">
      <span className="absolute end-3 top-3 z-10">
        <SaveExperienceButton slug={experience.slug} compact />
      </span>
      <LocaleLink
        href={`/experiences/${experience.slug}`}
        className={cn("flex h-full flex-col rounded-[1.125rem]", focusRing)}
      >
        <div className="relative overflow-hidden bg-brand-subtle">
          <div className={compact ? "aspect-[5/4]" : "aspect-[4/3]"}>
            <CatalogImage
              src={experience.image}
              alt={experience.imageAlt}
              areaLabel={experience.imageIsArea ? copy.areaPhoto : undefined}
              className="transition-transform duration-[250ms] ease-standard group-hover:scale-[1.035]"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4 pb-3.5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-muted">{category}</p>
          <h3 className="text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-text">
            <BidiText>{experience.title}</BidiText>
          </h3>
          <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-text-muted">
            <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="truncate">
              <BidiText>{place ?? experience.placeLabel}</BidiText>
              {region ? (
                <>
                  {" · "}
                  <BidiText>{region}</BidiText>
                </>
              ) : null}
            </span>
          </p>
          <ul className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-text-muted">
            {rating ? (
              <li className="inline-flex items-center gap-1 font-medium text-text">
                <Star className="size-3.5 fill-accent text-accent" aria-hidden />
                <span aria-label={interpolate(home.cardRating, { n: formatNumber(locale, rating) })}>
                  {formatNumber(locale, rating, { maximumFractionDigits: 1 })}
                </span>
              </li>
            ) : null}
            <li className="inline-flex items-center gap-1">
              <Clock className="size-3.5" strokeWidth={1.75} aria-hidden />
              {experience.hours} {copy.hoursLabel}
            </li>
            {experience.groupMax ? (
              <li className="inline-flex items-center gap-1">
                <Users className="size-3.5" strokeWidth={1.75} aria-hidden />
                {interpolate(home.cardUpTo, { n: experience.groupMax })}
              </li>
            ) : null}
          </ul>
          <div className="mt-auto flex items-end justify-between gap-3 border-t border-border-subtle pt-3">
            {experience.priceLabel === "quote" ? (
              <span className="text-sm font-semibold text-text">{copy.onRequest}</span>
            ) : !experience.priceFrom ? (
              <span className="text-sm font-semibold text-text">{copy.free}</span>
            ) : (
              <span className="text-xs text-text-muted">
                {copy.fromPrice}{" "}
                <span className="text-base font-semibold tracking-tight text-text">
                  {formatCurrency(locale, experience.priceFrom, "USD", { maximumFractionDigits: 0 })}
                </span>{" "}
                / {copy.perPerson}
                <span aria-hidden>*</span>
              </span>
            )}
            <span className="inline-flex shrink-0 items-center gap-1 text-[0.8125rem] font-semibold text-text">
              {home.cardViewDetails}
              <ArrowRight
                className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden
              />
            </span>
          </div>
        </div>
      </LocaleLink>
    </article>
  );
}
