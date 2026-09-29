import { ArrowRight } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { TourCardView } from "@/components/tours/tour-card";
import { interpolate } from "@/i18n/catalogues";
import type { Locale } from "@/lib/locale";
import type { TourCard } from "@/lib/tour-booking";
import { toursCopy } from "@/lib/tours-copy";
import { cn, focusRing } from "@/lib/utils";

/** "Guided tours in Byblos": tours that start in a destination, only when there are some. */
export function DestinationTours({
  tours,
  name,
  slug,
  locale,
}: {
  tours: TourCard[];
  name: string;
  slug: string;
  locale: Locale;
}) {
  if (!tours.length) {
    return null;
  }
  const copy = toursCopy[locale];
  return (
    <section aria-labelledby="destination-tours" className="shell-frame grid gap-5 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="destination-tours" className="title-section">
            {interpolate(copy.destinationTitle, { name })}
          </h2>
          <p className="text-text-muted">{copy.destinationBody}</p>
        </div>
        <LocaleLink
          href={`/tours?destination=${encodeURIComponent(slug)}`}
          className={cn("inline-flex items-center gap-1.5 font-semibold text-brand hover:underline", focusRing)}
        >
          {copy.seeAll}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </LocaleLink>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {tours.map((tour) => (
          <TourCardView key={tour.slug} tour={tour} copy={copy} locale={locale} />
        ))}
      </ul>
    </section>
  );
}
