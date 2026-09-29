import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Accessibility,
  Award,
  BadgeCheck,
  CalendarDays,
  Check,
  Clock,
  Languages,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { MessageGuide } from "@/components/messages/message-guide";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { tourPrice } from "@/components/tours/tour-card";
import { TourRouteMap } from "@/components/tours/tour-route-map";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { loadGuideReviews, loadTour } from "@/lib/guides-server";
import { languageName } from "@/lib/place-search";
import { seoText } from "@/lib/seo-copy";
import { buildMetadata, pathLocale, snippet } from "@/lib/seo/metadata";
import { breadcrumbSchema, faqSchema, graph, organizationSchema, tourSchema } from "@/lib/seo/schema";
import { tourBookingCopy, type TourBookingKey } from "@/lib/tour-booking-copy";
import { tourDuration, toursCopy } from "@/lib/tours-copy";
import { cn, focusRing } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [locale, tour] = await Promise.all([pathLocale(), loadTour(slug)]);
  if (!tour) {
    return buildMetadata({ title: toursCopy[locale].crumbTours, path: `/tours/${slug}`, noindex: true });
  }
  return buildMetadata({
    title: tour.title,
    description: snippet(tour.summary || tour.description) ?? tour.title,
    path: `/tours/${slug}`,
    image: tour.photos?.[0]?.url ?? undefined,
    imageAlt: tour.photos?.[0]?.alt_text,
  });
}

function Section({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-3">
      <h2 id={id} className="flex items-center gap-2 text-lg font-semibold">
        <span className="text-brand">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function TourPage({ params }: Props) {
  const { slug } = await params;
  const [locale, tour] = await Promise.all([pathLocale(), loadTour(slug)]);
  if (!tour) {
    notFound();
  }
  const copy = toursCopy[locale];
  const bookingCopy = tourBookingCopy[locale];
  const reviews = await loadGuideReviews(tour.guide.slug);
  const photos = (tour.photos ?? []).filter((photo) => photo.url);
  const price = tourPrice(copy, locale, { price_minor: tour.price_minor, price_unit: tour.price_unit });
  const crumbs = [
    { name: seoText(locale, "crumbHome"), path: "/" },
    { name: copy.crumbTours, path: "/tours" },
    { name: tour.title, path: `/tours/${tour.slug}` },
  ];
  const faqs = tour.faq ?? [];
  const stops = tour.route
    .filter((stop) => typeof stop.lat === "number" && typeof stop.lng === "number")
    .map((stop) => ({ key: stop.slug, lat: stop.lat as number, lng: stop.lng as number, label: stop.title }));
  const meeting =
    typeof tour.lat === "number" && typeof tour.lng === "number" ? { lat: tour.lat, lng: tour.lng } : null;
  const lines = (text: string) =>
    text
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

  return (
    <ShellMain className="gap-10">
      <JsonLd
        data={graph(organizationSchema(), breadcrumbSchema(crumbs, locale), tourSchema(tour, locale), faqSchema(faqs))}
      />
      <header className="grid gap-3">
        <Breadcrumbs crumbs={crumbs} label={seoText(locale, "crumbNav")} />
        {tour.destination ? (
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-accent-strong">
            {tour.destination.name}
          </p>
        ) : null}
        <h1 className="title-page text-[clamp(2rem,5vw,3rem)]">{tour.title}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden />
            {tourDuration(copy, tour.duration_minutes)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-4" aria-hidden />
            {interpolate(copy.upToPeople, { n: String(tour.max_party) })}
          </span>
          {tour.rating && tour.rating.count > 0 && tour.rating.average !== null ? (
            <span className="inline-flex items-center gap-1 text-text">
              <Star className="size-4 fill-accent text-accent" aria-hidden />
              {interpolate(tour.rating.count === 1 ? copy.reviewsCountOne : copy.reviewsCount, {
                avg: tour.rating.average.toFixed(1),
                n: String(tour.rating.count),
              })}
            </span>
          ) : null}
          {tour.booking.instant_booking ? (
            <span className="inline-flex items-center gap-1 text-text">
              <Zap className="size-4 text-accent" aria-hidden />
              {copy.instant}
            </span>
          ) : null}
        </p>
      </header>

      {photos.length ? (
        <div
          className={cn(
            "grid gap-2 overflow-hidden rounded-card",
            photos.length > 1 ? "md:grid-cols-[2fr_1fr] md:grid-rows-2" : "",
          )}
        >
          {photos.slice(0, 3).map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- photos come from several hosts without a loader
            <img
              key={photo.url}
              src={photo.url as string}
              alt={photo.alt_text}
              loading={index === 0 ? "eager" : "lazy"}
              className={cn(
                "size-full object-cover",
                index === 0
                  ? "aspect-[4/3] md:row-span-2 md:aspect-auto md:min-h-[24rem]"
                  : "hidden aspect-[4/3] md:block",
              )}
            />
          ))}
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="grid gap-10">
          {tour.highlights?.length ? (
            <Section id="highlights" title={copy.highlights} icon={<Sparkles className="size-5" aria-hidden />}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {tour.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-start gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
                    {highlight}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section id="about" title={copy.about} icon={<BadgeCheck className="size-5" aria-hidden />}>
            <p className="whitespace-pre-line leading-relaxed">{tour.description}</p>
          </Section>

          {stops.length || meeting ? (
            <Section id="route" title={copy.route} icon={<MapPin className="size-5" aria-hidden />}>
              <p className="text-sm text-text-muted">{copy.routeHint}</p>
              <TourRouteMap stops={stops} start={meeting} />
              {tour.route.length ? (
                <ol className="grid gap-2">
                  {tour.route.map((stop) => (
                    <li key={stop.slug} className="flex items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-white">
                        {stop.position}
                      </span>
                      <LocaleLink href={`/experiences/${stop.slug}`} className={cn("hover:underline", focusRing)}>
                        {stop.title}
                      </LocaleLink>
                    </li>
                  ))}
                </ol>
              ) : null}
            </Section>
          ) : null}

          <div className="grid gap-8 sm:grid-cols-2">
            <Section id="meeting" title={copy.meeting} icon={<MapPin className="size-5" aria-hidden />}>
              <p>{tour.meeting_point || "—"}</p>
            </Section>
            <Section id="languages" title={copy.languages} icon={<Languages className="size-5" aria-hidden />}>
              <p>{tour.languages.map((code) => languageName(code, locale)).join(" · ") || "—"}</p>
            </Section>
            {tour.included ? (
              <Section id="included" title={copy.included} icon={<Check className="size-5" aria-hidden />}>
                <ul className="grid gap-1">
                  {lines(tour.included).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {tour.bring ? (
              <Section id="bring" title={copy.bring} icon={<Check className="size-5" aria-hidden />}>
                <ul className="grid gap-1">
                  {lines(tour.bring).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {tour.accessibility ? (
              <Section
                id="accessibility"
                title={copy.accessibility}
                icon={<Accessibility className="size-5" aria-hidden />}
              >
                <p className="whitespace-pre-line">{tour.accessibility}</p>
              </Section>
            ) : null}
            <Section id="policy" title={bookingCopy.policyLabel} icon={<ShieldCheck className="size-5" aria-hidden />}>
              <p>{bookingCopy[`policy${tour.booking.policy}` as TourBookingKey]}</p>
              {tour.cancellation_terms ? <p className="text-sm text-text-muted">{tour.cancellation_terms}</p> : null}
            </Section>
          </div>

          <Section id="guide" title={copy.guideTitle} icon={<Award className="size-5" aria-hidden />}>
            <div className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-5">
              <p className="text-lg font-semibold">{tour.guide.display_name}</p>
              <p className="flex flex-wrap gap-2 text-sm text-text-muted">
                <span>{tour.guide.tier === "host" ? copy.localHost : copy.licensed}</span>
                {tour.guide.founding_number ? (
                  <span>· {interpolate(copy.founding, { n: String(tour.guide.founding_number) })}</span>
                ) : null}
              </p>
              {tour.guide.headline ? <p>{tour.guide.headline}</p> : null}
              <LocaleLink
                href={`/guides/${tour.guide.slug}`}
                className={cn("w-fit font-semibold text-brand hover:underline", focusRing)}
              >
                {interpolate(copy.seeGuide, { name: tour.guide.display_name })}
              </LocaleLink>
              <MessageGuide guideSlug={tour.guide.slug} next={`/tours/${tour.slug}`} />
            </div>
          </Section>

          <Section
            id="reviews"
            title={interpolate(copy.reviewsTitle, { name: tour.guide.display_name })}
            icon={<Star className="size-5" aria-hidden />}
          >
            {reviews && reviews.count > 0 ? (
              <ul className="grid gap-3">
                {reviews.recent.slice(0, 6).map((review) => (
                  <li
                    key={`${review.author}-${review.created_at}`}
                    className="grid gap-1 rounded-card border border-border-subtle bg-surface-raised p-4"
                  >
                    <p className="flex items-center gap-1 text-sm font-medium">
                      <Star className="size-4 fill-accent text-accent" aria-hidden />
                      {review.rating}/5 · {review.author}
                      <span className="text-text-muted">
                        · {formatDate(locale, review.created_at, { dateStyle: "medium" })}
                      </span>
                    </p>
                    {review.body ? <p>{review.body}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-text-muted">{copy.noReviews}</p>
            )}
          </Section>

          {faqs.length ? <FaqSection id="tour-faq" title={copy.faq} faqs={faqs} /> : null}
        </div>

        <aside
          aria-label={copy.checkAvailability}
          className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm lg:sticky lg:top-24"
        >
          {price ? <p className="text-2xl font-semibold tabular-nums">{price}</p> : null}
          <ul className="grid gap-2 text-sm">
            <li className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              {tour.next_start
                ? interpolate(copy.nextDate, {
                    date: formatDate(locale, tour.next_start, {
                      dateStyle: undefined,
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Beirut",
                    }),
                  })
                : copy.noDates}
            </li>
            <li className="flex items-start gap-2">
              <Zap className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              {tour.booking.instant_booking
                ? bookingCopy.instant
                : interpolate(bookingCopy.request, { n: String(tour.booking.request_ttl_hours) })}
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              {bookingCopy[`policy${tour.booking.policy}` as TourBookingKey]}
            </li>
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              {copy.paidOnDay}
            </li>
          </ul>
          <LocaleLink
            href={`/tours/${tour.slug}/book`}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-control bg-brand px-5 py-3 font-semibold text-brand-foreground hover:bg-brand/90",
              focusRing,
            )}
          >
            <CalendarDays className="size-4" aria-hidden />
            {copy.checkAvailability}
          </LocaleLink>
        </aside>
      </div>
    </ShellMain>
  );
}
