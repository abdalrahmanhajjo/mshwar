import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { TourBookingFlow } from "@/components/tours/tour-booking-flow";
import { interpolate } from "@/i18n/catalogues";
import { loadTour } from "@/lib/guides-server";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { tourBookingText } from "@/lib/tour-booking-copy";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [locale, tour] = await Promise.all([pathLocale(), loadTour(slug)]);
  const title = interpolate(tourBookingText(locale, "metaTitle"), { title: tour?.title ?? "" });
  // A booking step, not a page to rank: the tour page is the one to index.
  return buildMetadata({
    title,
    description: tour?.description.slice(0, 160) ?? title,
    path: `/tours/${slug}/book`,
    noindex: true,
  });
}

export default async function BookTourPage({ params }: Props) {
  const { slug } = await params;
  const [locale, tour] = await Promise.all([pathLocale(), loadTour(slug)]);
  if (!tour) {
    notFound();
  }
  return (
    <ShellMain>
      <header className="grid gap-2 pb-6">
        <p className="text-sm text-text-muted">
          <LocaleLink href={`/guides/${tour.guide.slug}`} className="hover:underline">
            {interpolate(tourBookingText(locale, "byGuide"), { name: tour.guide.display_name })}
          </LocaleLink>
        </p>
        <h1 className="title-page text-[clamp(1.7rem,4vw,2.4rem)]">
          {interpolate(tourBookingText(locale, "metaTitle"), { title: tour.title })}
        </h1>
      </header>
      <TourBookingFlow tour={tour} />
    </ShellMain>
  );
}
