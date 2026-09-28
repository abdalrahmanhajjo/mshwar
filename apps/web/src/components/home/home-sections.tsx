"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Map,
  MapPin,
  Route,
  Star,
  Tag,
} from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { HomeSearch } from "@/components/home/home-search";
import { MOODS, moodPhoto } from "@/components/home/moods";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { BidiText } from "@/components/ui/bidi-text";
import { formatDate, interpolate } from "@/i18n/catalogues";
import type { Destination } from "@/lib/catalog";
import type { TravellerStory } from "@/lib/catalogue-api";
import { useHomeCopy } from "@/lib/home-copy";
import { withLocalePrefix } from "@/lib/locale";
import { cn, focusRing } from "@/lib/utils";

/* ------------------------------------------------------------------ shared */

function Kicker({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "inverse" }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]",
        tone === "inverse" ? "text-white/75" : "text-text-muted",
      )}
    >
      <span className="size-1.5 rounded-full bg-accent" aria-hidden />
      {children}
    </p>
  );
}

function SectionHead({
  id,
  kicker,
  title,
  action,
}: {
  id: string;
  kicker: string;
  title: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="grid max-w-2xl gap-3">
        <Kicker>{kicker}</Kicker>
        <h2
          id={id}
          className="text-balance text-[clamp(1.875rem,1.4rem+1.6vw,2.75rem)] font-[560] leading-[1.06] tracking-[-0.035em] text-text"
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <LocaleLink
      href={href}
      className={cn(
        "group inline-flex min-h-10 items-center gap-1.5 rounded-sm text-sm font-semibold text-text underline decoration-border underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-text",
        focusRing,
      )}
    >
      {children}
      <ArrowRight
        className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
        aria-hidden
      />
    </LocaleLink>
  );
}

/* -------------------------------------------------------------------- hero */

export function HomeHero({ image, destinations }: { image: string; destinations: Destination[] }) {
  const copy = useHomeCopy();
  return (
    <section aria-labelledby="home-hero" className="relative">
      <div className="sm:px-3 sm:pt-3">
        <div className="relative isolate overflow-hidden bg-brand sm:rounded-[1.5rem]">
          <CatalogImage src={image} alt="" priority className="absolute inset-0 h-full w-full object-[center_40%]" />
          {/* Two quiet layers: one keeps the headline legible, one grounds the search. */}
          <div className="photo-scrim-side absolute inset-0" aria-hidden />
          <div
            className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[rgb(12_31_28/0.55)] to-transparent"
            aria-hidden
          />
          <div className="shell-frame relative flex min-h-[31rem] flex-col justify-end gap-5 pb-24 pt-24 text-white sm:min-h-[34rem] lg:min-h-[40rem] lg:pb-32">
            <Kicker tone="inverse">{copy.heroEyebrow}</Kicker>
            <h1
              id="home-hero"
              className="max-w-[15ch] text-balance text-[clamp(2.625rem,1.5rem+4.4vw,5rem)] font-[560] leading-[0.98] tracking-[-0.045em]"
            >
              {copy.heroTitleLead} <span className="text-serif text-accent">{copy.heroTitleAccent}</span>{" "}
              {copy.heroTitleTail}
            </h1>
            <p className="max-w-[34rem] text-[1.0625rem] leading-relaxed text-white/85">{copy.heroBody}</p>
            <p className="absolute bottom-6 end-[var(--layout-gutter-mobile)] hidden items-center gap-1.5 text-xs text-white/70 lg:end-[var(--layout-gutter-desktop)] lg:bottom-10 lg:inline-flex">
              <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />
              {copy.heroPhotoCredit}
            </p>
          </div>
        </div>
      </div>
      <div className="shell-frame relative z-10 -mt-14 lg:-mt-11">
        <div className="max-w-[70rem]">
          <HomeSearch destinations={destinations} />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- why strip */

export function WhyMshwar() {
  const copy = useHomeCopy();
  const items = [
    { icon: BadgeCheck, title: copy.why1Title, body: copy.why1Body },
    { icon: Map, title: copy.why2Title, body: copy.why2Body },
    { icon: Tag, title: copy.why3Title, body: copy.why3Body },
    { icon: Route, title: copy.why4Title, body: copy.why4Body },
  ];
  return (
    <section aria-label={copy.whyTitle} className="shell-frame">
      <ul className="grid grid-cols-1 gap-x-8 gap-y-5 border-b border-border-subtle pb-10 pt-10 sm:grid-cols-2 lg:grid-cols-4 lg:pt-12">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3.5">
            <item.icon className="mt-0.5 size-5 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
            <div className="grid gap-0.5">
              <p className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-text">{item.title}</p>
              <p className="text-sm leading-relaxed text-text-muted">{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------- mood grid */

// Editorial rhythm on large screens: one tall feature, two squares, one wide, then
// the cedar "everything" tile, a square and a wide. On phones the row scrolls.
const MOOD_SPANS: Record<string, string> = {
  nature: "lg:col-span-2 lg:row-span-2",
  coast: "",
  culture: "",
  adventure: "lg:col-span-2",
  city: "",
  food: "lg:col-span-2",
};
const MOOD_ORDER = ["nature", "coast", "culture", "adventure", "all", "city", "food"] as const;

export function MoodGrid({ destinations }: { destinations: Destination[] }) {
  const copy = useHomeCopy();
  const used = new Set<string>();
  const photos = Object.fromEntries(MOODS.map((mood) => [mood.slug, moodPhoto(mood, destinations, used)]));

  return (
    <section aria-labelledby="home-moods" className="shell-frame grid gap-8">
      <SectionHead id="home-moods" kicker={copy.moodKicker} title={copy.moodTitle} />
      <ul className="scrollbar-hide -mx-[var(--layout-gutter-mobile)] flex snap-x snap-mandatory scroll-px-[var(--layout-gutter-mobile)] gap-3 overflow-x-auto px-[var(--layout-gutter-mobile)] pb-1 lg:mx-0 lg:grid lg:auto-rows-[12.5rem] lg:grid-cols-4 lg:gap-4 lg:overflow-visible lg:px-0">
        {MOOD_ORDER.map((slug) => {
          if (slug === "all") {
            return (
              <li key="all" className="w-[13.5rem] shrink-0 snap-start lg:w-auto">
                <LocaleLink
                  href="/experiences"
                  className={cn(
                    "group flex h-44 flex-col justify-between rounded-[1.125rem] bg-brand p-5 text-brand-foreground transition-colors duration-200 hover:bg-brand/92 lg:h-full",
                    focusRing,
                  )}
                >
                  <ArrowUpRight
                    className="size-5 self-end transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100"
                    aria-hidden
                  />
                  <span className="grid gap-1">
                    <span className="text-lg font-semibold tracking-[-0.02em]">{copy.moodAll}</span>
                    <span className="text-[0.8125rem] leading-snug text-brand-foreground/75">{copy.moodAllLine}</span>
                  </span>
                </LocaleLink>
              </li>
            );
          }
          const mood = MOODS.find((item) => item.slug === slug);
          if (!mood) return null;
          const photo = photos[slug];
          return (
            <li key={slug} className={cn("w-[13.5rem] shrink-0 snap-start lg:w-auto", MOOD_SPANS[slug])}>
              <LocaleLink
                href={`/things-to-do/${mood.slug}`}
                className={cn(
                  "group relative isolate block h-44 overflow-hidden rounded-[1.125rem] bg-brand-subtle lg:h-full",
                  focusRing,
                )}
              >
                {photo ? (
                  <CatalogImage
                    src={photo.image}
                    alt=""
                    className="absolute inset-0 transition-transform duration-[250ms] ease-standard group-hover:scale-[1.04]"
                  />
                ) : null}
                <div className="photo-scrim absolute inset-0" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-white">
                  <span className="grid gap-0.5">
                    <span
                      className={cn("font-semibold tracking-[-0.02em]", slug === "nature" ? "text-2xl" : "text-lg")}
                    >
                      {copy[mood.label]}
                    </span>
                    <span className="text-[0.8125rem] leading-snug text-white/80">{copy[mood.line]}</span>
                  </span>
                  <ArrowUpRight
                    className="size-5 shrink-0 opacity-0 transition-all duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 rtl:-scale-x-100"
                    aria-hidden
                  />
                </div>
              </LocaleLink>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------- planner showcase */

export function PlannerShowcase() {
  const copy = useHomeCopy();
  const stops = [
    { time: "09:00", title: copy.plannerStop1, place: copy.plannerStop1Place, drive: null },
    { time: "10:45", title: copy.plannerStop2, place: copy.plannerStop2Place, drive: 25 },
    { time: "13:15", title: copy.plannerStop3, place: copy.plannerStop3Place, drive: 15 },
    { time: "17:30", title: copy.plannerStop4, place: copy.plannerStop4Place, drive: 10 },
  ];
  const benefits = [copy.plannerBenefit1, copy.plannerBenefit2, copy.plannerBenefit3];

  return (
    <section aria-labelledby="home-planner" className="sm:px-3">
      <div className="bg-brand text-brand-foreground sm:rounded-[1.5rem]">
        <div className="shell-frame grid items-center gap-12 py-16 lg:grid-cols-12 lg:gap-8 lg:py-20">
          <div className="grid gap-6 lg:col-span-5">
            <Kicker tone="inverse">{copy.plannerKicker}</Kicker>
            <h2
              id="home-planner"
              className="text-balance text-[clamp(1.875rem,1.4rem+1.6vw,2.75rem)] font-[560] leading-[1.06] tracking-[-0.035em]"
            >
              {copy.plannerTitleLead} <span className="text-serif text-accent">{copy.plannerTitleAccent}</span>
            </h2>
            <p className="max-w-md text-[1.0625rem] leading-relaxed text-brand-foreground/80">{copy.plannerBody}</p>
            <ul className="grid gap-2.5">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-center gap-3 text-[0.9375rem]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-foreground/10">
                    <Check className="size-3.5" strokeWidth={2.2} aria-hidden />
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              <LocaleLink
                href="/plan"
                className={cn(
                  "group inline-flex h-12 items-center gap-2 rounded-pill bg-accent px-6 text-[0.9375rem] font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90",
                  focusRing,
                )}
              >
                {copy.planYourTrip}
                <ArrowRight
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100"
                  aria-hidden
                />
              </LocaleLink>
              <LocaleLink
                href="/plan"
                className={cn(
                  "inline-flex h-12 items-center rounded-pill border border-brand-foreground/35 px-6 text-[0.9375rem] font-semibold transition-colors duration-200 hover:border-brand-foreground/70",
                  focusRing,
                )}
              >
                {copy.plannerSecondary}
              </LocaleLink>
            </div>
          </div>

          {/* The planner's own day view, at rest: numbered stops, times and the drive between them. */}
          <figure className="lg:col-span-6 lg:col-start-7">
            <div className="overflow-hidden rounded-[1.25rem] bg-surface-raised text-text shadow-[0_30px_60px_-30px_rgb(0_0_0/0.45)]">
              <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4 sm:px-6">
                <div className="grid">
                  <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {copy.plannerCardDay}
                  </span>
                  <span className="text-lg font-semibold tracking-[-0.02em]">{copy.plannerCardStops}</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  <Check className="size-3.5" strokeWidth={2.4} aria-hidden />
                  {copy.plannerCardFits}
                </span>
              </div>
              <ol className="px-5 py-2 sm:px-6">
                {stops.map((stop, index) => (
                  <li key={stop.title}>
                    {stop.drive ? (
                      <p className="flex items-center gap-2 py-1.5 ps-[3.25rem] text-xs text-text-muted">
                        <Car className="size-3.5" strokeWidth={1.75} aria-hidden />
                        {interpolate(copy.plannerDrive, { n: stop.drive })}
                      </p>
                    ) : null}
                    <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-[0.875rem] py-2.5">
                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-full text-sm font-semibold tabular-nums",
                          index === stops.length - 1
                            ? "bg-accent text-accent-foreground"
                            : "bg-brand-subtle text-brand",
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="grid min-w-0">
                        <span className="text-pretty text-[0.9375rem] font-semibold leading-snug">{stop.title}</span>
                        <span className="text-[0.8125rem] text-text-muted">{stop.place}</span>
                      </span>
                      <span className="text-sm font-medium tabular-nums text-text-muted">{stop.time}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <figcaption className="mt-3 text-xs text-brand-foreground/65">{copy.plannerCardNote}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- destinations */

// A 4-column mosaic: a large lead, then squares and wides so the row never repeats.
const DEST_SPANS = [
  "col-span-2 lg:col-span-2 lg:row-span-2",
  "",
  "",
  "",
  "",
  "col-span-2 lg:col-span-2",
  "col-span-2 lg:col-span-2",
];

export function DestinationMosaic({ destinations }: { destinations: Destination[] }) {
  const copy = useHomeCopy();
  const shown = destinations.filter((item) => item.image).slice(0, 7);
  if (!shown.length) return null;
  return (
    <section aria-labelledby="home-destinations" className="shell-frame grid gap-8">
      <SectionHead
        id="home-destinations"
        kicker={copy.destKicker}
        title={copy.destTitle}
        action={<TextLink href="/destinations">{copy.destAll}</TextLink>}
      />
      <ul className="grid auto-rows-[11.5rem] grid-cols-2 gap-3 sm:auto-rows-[14rem] lg:auto-rows-[15.5rem] lg:grid-cols-4 lg:gap-4">
        {shown.map((destination, index) => (
          <li key={destination.slug} className={DEST_SPANS[index] ?? ""}>
            <LocaleLink
              href={`/destinations/${destination.slug}`}
              className={cn(
                "group relative isolate block h-full overflow-hidden rounded-[1.125rem] bg-brand",
                focusRing,
              )}
            >
              <CatalogImage
                src={destination.image}
                alt={destination.imageAlt}
                className="absolute inset-0 transition-transform duration-[250ms] ease-standard group-hover:scale-[1.04]"
              />
              <div className="photo-scrim absolute inset-0" aria-hidden />
              <span className="absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-white/0 text-white transition-colors duration-200 group-hover:bg-white/20">
                <ArrowUpRight className="size-5 rtl:-scale-x-100" aria-hidden />
              </span>
              <div className="absolute inset-x-0 bottom-0 grid gap-0.5 p-4 text-white sm:p-5">
                <h3
                  className={cn(
                    "font-semibold leading-tight tracking-[-0.03em]",
                    index === 0 ? "text-[1.75rem] lg:text-[2.25rem]" : "text-xl",
                  )}
                >
                  <BidiText>{destination.name}</BidiText>
                </h3>
                <p
                  className={cn(
                    "text-[0.8125rem] leading-snug text-white/80",
                    index === 0 ? "max-w-sm lg:text-sm" : "line-clamp-1",
                  )}
                >
                  {destination.blurb || destination.region}
                </p>
              </div>
            </LocaleLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------- editorial moment */

export function EditorialMoment({ destinations }: { destinations: Destination[] }) {
  const copy = useHomeCopy();
  const photo =
    ["qadisha-valley", "bsharri", "north-lebanon", "mount-lebanon"]
      .map((slug) => destinations.find((item) => item.slug === slug && item.image))
      .find(Boolean) ?? destinations.find((item) => item.image);

  return (
    <section aria-labelledby="home-story" className="shell-frame">
      <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="relative lg:col-span-7">
          <div className="aspect-[4/3] overflow-hidden rounded-[1.25rem] bg-brand-subtle lg:aspect-[7/6]">
            {photo ? <CatalogImage src={photo.image} alt={photo.imageAlt} /> : null}
          </div>
          {photo ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-text-muted">
              <MapPin className="size-3.5" strokeWidth={1.75} aria-hidden />
              <BidiText>{photo.name}</BidiText>
            </p>
          ) : null}
        </div>
        <div className="grid gap-6 lg:col-span-4 lg:col-start-9">
          <Kicker>{copy.storyKicker}</Kicker>
          <h2
            id="home-story"
            className="text-balance text-[clamp(2rem,1.4rem+2vw,3.25rem)] font-[560] leading-[1.02] tracking-[-0.04em] text-text"
          >
            {copy.storyTitle}
          </h2>
          <p className="text-[1.0625rem] leading-relaxed text-text-muted">{copy.storyBody}</p>
          {/* The page's one editorial aside. */}
          <p className="flex items-center gap-3 text-serif text-2xl text-brand">
            <svg viewBox="0 0 48 16" className="h-4 w-12 shrink-0 text-accent rtl:-scale-x-100" aria-hidden>
              <path
                d="M2 10c8-8 14 6 22-2s12 4 20-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {copy.storyNote}
          </p>
          <div>
            <TextLink href="/plan">{copy.storyCta}</TextLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- traveller story */

export function TravellerStories({ stories }: { stories: TravellerStory[] }) {
  const copy = useHomeCopy();
  const { locale } = useLocale();
  const [index, setIndex] = React.useState(0);
  if (!stories.length) return null;
  const story = stories[index % stories.length];
  if (!story) return null;
  const nav = cn(
    "grid size-11 place-items-center rounded-full border border-border-subtle text-text transition-colors duration-200 hover:border-brand/40 hover:bg-brand-subtle",
    focusRing,
  );

  return (
    <section aria-labelledby="home-reviews" className="shell-frame">
      <div className="grid items-center gap-8 border-y border-border-subtle py-14 lg:grid-cols-12 lg:gap-8 lg:py-16">
        <div className="lg:col-span-4">
          <div className="aspect-[4/5] max-h-[26rem] overflow-hidden rounded-[1.25rem] bg-brand-subtle">
            <CatalogImage src={story.image} alt={story.imageAlt} />
          </div>
        </div>
        <figure className="grid gap-6 lg:col-span-7 lg:col-start-6" aria-live="polite">
          <Kicker>
            <span id="home-reviews">{copy.reviewsKicker}</span>
          </Kicker>
          <span className="flex gap-0.5" aria-label={interpolate(copy.cardRating, { n: story.rating })}>
            {Array.from({ length: 5 }, (_, star) => (
              <Star
                key={star}
                className={cn("size-4", star < story.rating ? "fill-accent text-accent" : "text-border")}
                aria-hidden
              />
            ))}
          </span>
          <blockquote className="text-balance text-[clamp(1.375rem,1.1rem+1vw,2rem)] font-[480] leading-snug tracking-[-0.02em] text-text">
            “<BidiText>{story.body}</BidiText>”
          </blockquote>
          <figcaption className="flex flex-wrap items-center justify-between gap-4">
            <span className="grid gap-0.5 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-text">
                <BadgeCheck className="size-4 text-brand" strokeWidth={1.75} aria-hidden />
                {copy.reviewsVerified} · {formatDate(locale, story.createdAt, { month: "long", year: "numeric" })}
              </span>
              <LocaleLink
                href={`/experiences/${story.experienceSlug}`}
                className={cn("text-text-muted hover:text-text", focusRing)}
              >
                {interpolate(copy.reviewsOn, { title: story.experienceTitle })}
              </LocaleLink>
            </span>
            {stories.length > 1 ? (
              <span className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-text-muted">
                  {interpolate(copy.reviewsOf, { n: index + 1, total: stories.length })}
                </span>
                <button
                  type="button"
                  className={nav}
                  aria-label={copy.reviewsPrev}
                  onClick={() => setIndex((i) => (i - 1 + stories.length) % stories.length)}
                >
                  <ChevronLeft className="size-5 rtl:-scale-x-100" aria-hidden />
                </button>
                <button
                  type="button"
                  className={nav}
                  aria-label={copy.reviewsNext}
                  onClick={() => setIndex((i) => (i + 1) % stories.length)}
                >
                  <ChevronRight className="size-5 rtl:-scale-x-100" aria-hidden />
                </button>
              </span>
            ) : null}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ stay inspired */

export function StayInspired() {
  const copy = useHomeCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const [email, setEmail] = React.useState("");

  // There is no separate mailing list: updates are an opt-in on a free account,
  // so this hands the address to sign-up, where the traveller chooses.
  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({ email: email.trim() });
    router.push(withLocalePrefix(locale, `/signup?${params}`));
  }

  return (
    <section aria-labelledby="home-inspired" className="shell-frame">
      <div className="surface-grain grid items-center gap-8 rounded-[1.5rem] bg-surface-sunken px-5 py-10 min-[360px]:px-6 sm:px-10 lg:grid-cols-12 lg:gap-8 lg:px-14 lg:py-14">
        <div className="grid gap-3 lg:col-span-6">
          <h2
            id="home-inspired"
            className="text-[clamp(1.75rem,1.35rem+1.4vw,2.5rem)] font-[560] leading-[1.06] tracking-[-0.035em] text-text"
          >
            {copy.inspiredTitle}
          </h2>
          <p className="max-w-md text-[0.9375rem] leading-relaxed text-text-muted">{copy.inspiredBody}</p>
        </div>
        <form onSubmit={onSubmit} className="grid gap-2 lg:col-span-5 lg:col-start-8">
          <label htmlFor="home-email" className="text-sm font-medium text-text">
            {copy.inspiredEmail}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="home-email"
              type="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-12 w-full min-w-0 rounded-pill border border-border bg-surface-raised px-5 text-base sm:flex-1 sm:text-[0.9375rem] text-text outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-pill bg-brand px-6 text-[0.9375rem] font-semibold text-brand-foreground transition-colors duration-200 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              {copy.inspiredCta}
            </button>
          </div>
          <p className="text-xs text-text-muted">{copy.inspiredNote}</p>
        </form>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- mobile sticky CTA */

/** On phones, once the hero has scrolled away, the next step stays one thumb away. */
export function MobilePlanBar() {
  const copy = useHomeCopy();
  const [shown, setShown] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setShown(window.scrollY > 560);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur transition-transform duration-200 md:hidden",
        shown ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      aria-hidden={!shown}
    >
      <LocaleLink
        href="/plan"
        tabIndex={shown ? undefined : -1}
        className={cn(
          "flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-brand text-[0.9375rem] font-semibold text-brand-foreground",
          focusRing,
        )}
      >
        {copy.planYourTrip}
        <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
      </LocaleLink>
    </div>
  );
}
