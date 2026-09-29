import { Award, CalendarDays, Clock, ImageOff, Star, Zap } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import type { Locale } from "@/lib/locale";
import type { TourCard as Tour } from "@/lib/tour-booking";
import { tourDuration, type ToursCopy } from "@/lib/tours-copy";
import { cn, focusRing } from "@/lib/utils";

export function tourPrice(copy: ToursCopy, locale: Locale, tour: Pick<Tour, "price_minor" | "price_unit">) {
  if (tour.price_minor === null) {
    return null;
  }
  if (tour.price_minor === 0) {
    return copy.free;
  }
  const amount = formatCurrency(locale, tour.price_minor / 100, "USD", {
    maximumFractionDigits: tour.price_minor % 100 ? 2 : 0,
  });
  return `${interpolate(copy.fromPrice, { price: amount })} ${tour.price_unit === "group" ? copy.perGroup : copy.perPerson}`;
}

/** One tour on the marketplace or a destination page. Works in server and client components. */
export function TourCardView({ tour, copy, locale }: { tour: Tour; copy: ToursCopy; locale: Locale }) {
  const price = tourPrice(copy, locale, tour);
  return (
    <li className="group relative grid overflow-hidden rounded-card border border-border-subtle bg-surface-raised shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-sunken">
        {tour.photo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element -- photos come from several hosts without a loader
          <img
            src={tour.photo.url}
            alt={tour.photo.alt_text}
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center text-text-muted">
            <span className="flex items-center gap-2 text-sm">
              <ImageOff className="size-4" aria-hidden />
              {copy.photoFallback}
            </span>
          </div>
        )}
        {tour.instant_booking ? (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-pill bg-surface-raised/95 px-2.5 py-1 text-xs font-semibold text-text shadow-sm">
            <Zap className="size-3.5 text-accent" aria-hidden />
            {copy.instant}
          </span>
        ) : null}
      </div>
      <div className="grid gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-text-muted">
          {tour.destination?.name ?? ""}
        </p>
        <h3 className="title-card text-[1.05rem] leading-snug">
          <LocaleLink
            href={`/tours/${tour.slug}`}
            className={cn("after:absolute after:inset-0 after:content-['']", focusRing)}
          >
            {tour.title}
          </LocaleLink>
        </h3>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {tourDuration(copy, tour.duration_minutes)}
          </span>
          {tour.rating.count > 0 && tour.rating.average !== null ? (
            <span className="inline-flex items-center gap-1 text-text">
              <Star className="size-3.5 fill-accent text-accent" aria-hidden />
              {interpolate(tour.rating.count === 1 ? copy.reviewsCountOne : copy.reviewsCount, {
                avg: tour.rating.average.toFixed(1),
                n: String(tour.rating.count),
              })}
            </span>
          ) : (
            <span>{copy.noReviewsYet}</span>
          )}
        </p>
        <p className="flex items-center gap-1.5 text-sm">
          {tour.guide.founding_number ? <Award className="size-3.5 text-accent" aria-hidden /> : null}
          {interpolate(copy.byGuide, { name: tour.guide.display_name })}
          <span className="text-text-muted">· {tour.guide.tier === "host" ? copy.localHost : copy.licensed}</span>
        </p>
        <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
            <CalendarDays className="size-3.5" aria-hidden />
            {tour.next_start
              ? interpolate(copy.nextDate, {
                  date: formatDate(locale, tour.next_start, {
                    dateStyle: undefined,
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    timeZone: "Asia/Beirut",
                  }),
                })
              : copy.noDates}
          </span>
          {price ? <span className="font-semibold tabular-nums">{price}</span> : null}
        </div>
      </div>
    </li>
  );
}
