"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Map as MapIcon, MapPin } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { BidiText } from "@/components/ui/bidi-text";
import { interpolate } from "@/i18n/catalogues";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Experience } from "@/lib/catalog";
import { useHomeCopy } from "@/lib/home-copy";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH, outlineDots, project } from "@/lib/lebanon-outline";
import { listingCoordinates } from "@/lib/listing-coordinates";
import { useNearViewport } from "@/lib/use-near-viewport";
import { cn, focusRing } from "@/lib/utils";

// MapLibre (and its stylesheet) load only when the section comes near.
const LebanonMap = dynamic(() => import("@/components/browse/lebanon-map").then((mod) => mod.LebanonMap), {
  ssr: false,
});

const DOT_RADIUS = 3.4;
// Every dot in one path keeps the page light: a circle is two half-arcs.
const DOTS_PATH = outlineDots()
  .map(
    ({ x, y }) =>
      `M${(x - DOT_RADIUS).toFixed(1)} ${y.toFixed(1)}a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 ${DOT_RADIUS * 2} 0a${DOT_RADIUS} ${DOT_RADIUS} 0 1 0 ${-DOT_RADIUS * 2} 0`,
  )
  .join("");

// Towns drawn on the preview for orientation.
// Coastal names sit out at sea and Baalbek's inland, clear of the pins.
const TOWNS = [
  { key: "mapTripoli", lng: 35.84, lat: 34.44, side: "west" },
  { key: "mapBeirut", lng: 35.5, lat: 33.89, side: "west" },
  { key: "mapBaalbek", lng: 36.2, lat: 34.0, side: "east" },
  { key: "mapTyre", lng: 35.2, lat: 33.27, side: "west" },
] as const;
const LABEL_GAP = 30;

type Pin = { key: string; x: number; y: number; items: Experience[] };

// Pins closer than this (in preview units) would overlap, so they share one pin.
const PIN_MERGE = 30;

/** Places at or near the same spot (for example a town centre) share one numbered pin. */
function pinsFor(items: Experience[]): Pin[] {
  const pins: Pin[] = [];
  for (const item of items) {
    const point = listingCoordinates(item);
    if (!point) continue;
    const { x, y } = project(point.lng, point.lat);
    const near = pins.find((pin) => Math.hypot(pin.x - x, pin.y - y) < PIN_MERGE);
    if (near) near.items.push(item);
    else pins.push({ key: item.slug, x, y, items: [item] });
  }
  return pins;
}

const percent = (value: number, total: number) => `${((value / total) * 100).toFixed(3)}%`;

/**
 * The homepage map: the real map of Lebanon (OpenStreetMap through MapLibre, no key, tiles served
 * from our own origin) with every place on it. MapLibre loads when the section comes near; until it
 * has drawn, and if it cannot (no WebGL, offline), Lebanon is shown as a field of dots with the same
 * pins, so the section never waits on the network.
 */
export function HomeMap({ experiences }: { experiences: Experience[] }) {
  const copy = useHomeCopy();
  const browse = useBrowseCopy();
  const frame = React.useRef<HTMLDivElement>(null);
  const pins = React.useMemo(() => pinsFor(experiences), [experiences]);
  const mapped = React.useMemo(() => pins.flatMap((pin) => pin.items), [pins]);
  const regions = new Set(mapped.map((item) => item.destinationSlug)).size;
  const [active, setActive] = React.useState<string | null>(null);
  const near = useNearViewport(frame, "400px");
  const [ready, setReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const selected = mapped.find((item) => item.slug === active) ?? mapped[0] ?? null;

  if (!mapped.length) return null;

  function choosePin(pin: Pin) {
    // A shared pin steps through its places, one per tap.
    const index = pin.items.findIndex((item) => item.slug === selected?.slug);
    setActive(pin.items[(index + 1) % pin.items.length]?.slug ?? null);
  }

  const live = near && !failed;

  return (
    <section aria-labelledby="home-map" className="shell-frame">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-10 lg:gap-y-8">
        <div className="grid content-end gap-5 lg:col-span-5 lg:row-start-1">
          <p className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-text-muted">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden />
            {copy.mapKicker}
          </p>
          <h2
            id="home-map"
            className="text-balance text-[clamp(1.875rem,1.4rem+1.6vw,2.75rem)] font-[560] leading-[1.06] tracking-[-0.035em] text-text"
          >
            {copy.mapTitleLead} <span className="text-serif text-brand">{copy.mapTitleAccent}</span>
          </h2>
          <p className="max-w-md text-[1.0625rem] leading-relaxed text-text-muted">{copy.mapBody}</p>
          <dl className="flex gap-8">
            <div className="grid">
              <dt className="order-2 text-[0.8125rem] text-text-muted">{copy.mapStatPlaces}</dt>
              <dd className="order-1 text-[2rem] font-semibold tabular-nums leading-none tracking-[-0.03em] text-text">
                {mapped.length}
              </dd>
            </div>
            <div className="grid">
              <dt className="order-2 text-[0.8125rem] text-text-muted">{copy.mapStatRegions}</dt>
              <dd className="order-1 text-[2rem] font-semibold tabular-nums leading-none tracking-[-0.03em] text-text">
                {regions}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid min-w-0 gap-3 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">
          <div
            ref={frame}
            className="relative h-[440px] overflow-hidden rounded-[1.5rem] bg-brand shadow-[0_40px_80px_-40px_rgb(18_53_47/0.55)] ring-1 ring-brand/10 sm:h-[520px] lg:h-[620px]"
          >
            {live ? (
              <LebanonMap
                items={mapped}
                active={selected?.slug ?? null}
                onSelect={setActive}
                onError={() => setFailed(true)}
                onReady={() => setReady(true)}
                label={copy.mapLabel}
                className="size-full"
              />
            ) : null}
            {ready && live ? null : (
              <MapPreview
                pins={pins}
                selected={selected?.slug ?? null}
                onPin={choosePin}
                pinLabel={(pin) =>
                  pin.items
                    .map((item) => interpolate(copy.mapPin, { title: item.title, place: item.placeLabel }))
                    .join(" · ")
                }
              />
            )}
            <p
              className={cn(
                "pointer-events-none absolute start-4 top-4 inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur sm:start-5 sm:top-5",
                ready && live ? "bg-white/90 text-text" : "bg-white/10 text-white/85",
              )}
            >
              <MapPin className="size-3.5 text-accent" aria-hidden />
              {failed ? browse.mapUnavailable : copy.mapHint}
            </p>
          </div>

          {/* Every place as a button too: the keyboard and screen-reader way round the map. */}
          <ul className="scrollbar-hide -mx-[var(--layout-gutter-mobile)] flex gap-2 overflow-x-auto px-[var(--layout-gutter-mobile)] pb-1 md:mx-0 md:px-0">
            {mapped.map((item) => (
              <li key={item.slug} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={item.slug === selected?.slug}
                  onClick={() => setActive(item.slug)}
                  className={cn(
                    "inline-flex min-h-10 items-center gap-1.5 rounded-pill border px-3.5 text-sm transition-colors duration-200",
                    item.slug === selected?.slug
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border-subtle bg-surface-raised text-text hover:border-brand/40",
                    focusRing,
                  )}
                >
                  <MapPin className="size-3.5 shrink-0" aria-hidden />
                  <BidiText>{item.title}</BidiText>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid content-start gap-4 lg:col-span-5 lg:row-start-2">
          {selected ? <SelectedPlace item={selected} /> : null}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <LocaleLink
              href="/experiences?view=map"
              className={cn(
                "group inline-flex h-12 items-center gap-2 rounded-pill bg-brand px-6 text-[0.9375rem] font-semibold text-brand-foreground transition-colors duration-200 hover:bg-brand/90",
                focusRing,
              )}
            >
              <MapIcon className="size-4" aria-hidden />
              {copy.mapOpenFull}
            </LocaleLink>
            <LocaleLink
              href="/experiences"
              className={cn(
                "group inline-flex min-h-10 items-center gap-1.5 rounded-sm text-sm font-semibold text-text underline decoration-border underline-offset-[6px] transition-[text-decoration-color] duration-200 hover:decoration-text",
                focusRing,
              )}
            >
              {copy.mapAll}
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
                aria-hidden
              />
            </LocaleLink>
          </div>
        </div>
      </div>
    </section>
  );
}

function MapPreview({
  pins,
  selected,
  onPin,
  pinLabel,
}: {
  pins: Pin[];
  selected: string | null;
  onPin: (pin: Pin) => void;
  pinLabel: (pin: Pin) => string;
}) {
  const copy = useHomeCopy();
  return (
    // Geography does not mirror: the preview keeps west on the west in Arabic too.
    <div
      dir="ltr"
      className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_80%_at_70%_30%,rgb(255_255_255/0.09),transparent_60%)] p-6 sm:p-10"
    >
      {/* The map keeps its proportions; pins are placed in percentages of the same box. */}
      <div className="relative h-full max-w-full" style={{ aspectRatio: `${PREVIEW_WIDTH} / ${PREVIEW_HEIGHT}` }}>
        <svg
          viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}
          className="absolute inset-0 size-full"
          role="img"
          aria-label={copy.mapPreview}
        >
          <text
            x={PREVIEW_WIDTH * 0.1}
            y={PREVIEW_HEIGHT * 0.62}
            transform={`rotate(-62 ${PREVIEW_WIDTH * 0.1} ${PREVIEW_HEIGHT * 0.62})`}
            className="text-serif fill-white/35 text-[22px] italic tracking-[0.2em]"
          >
            {copy.mapSea}
          </text>
          <path d={DOTS_PATH} className="fill-white/25" />
          {TOWNS.map((town) => {
            const point = project(town.lng, town.lat);
            return (
              <g key={town.key} aria-hidden>
                <circle cx={point.x} cy={point.y} r={2.5} className="fill-white/70" />
                <text
                  x={town.side === "west" ? point.x - LABEL_GAP : point.x + LABEL_GAP}
                  y={point.y + 5}
                  textAnchor={town.side === "west" ? "end" : "start"}
                  className="fill-white/60 text-[15px] font-medium tracking-[0.04em]"
                >
                  {copy[town.key]}
                </text>
              </g>
            );
          })}
        </svg>

        <ul>
          {pins.map((pin) => {
            const isActive = pin.items.some((item) => item.slug === selected);
            const count = pin.items.length;
            return (
              <li
                key={pin.key}
                className={cn("absolute -translate-x-1/2 -translate-y-1/2", isActive ? "z-20" : "z-10")}
                style={{ left: percent(pin.x, PREVIEW_WIDTH), top: percent(pin.y, PREVIEW_HEIGHT) }}
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  aria-label={pinLabel(pin)}
                  onClick={() => onPin(pin)}
                  className={cn("group relative grid size-11 place-items-center rounded-full", focusRing)}
                >
                  {isActive ? (
                    <span
                      className="absolute inset-1.5 rounded-full bg-accent/40 motion-safe:animate-ping"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative grid place-items-center rounded-full border-2 border-white bg-accent font-semibold tabular-nums text-accent-foreground shadow-[0_6px_16px_-4px_rgb(0_0_0/0.5)] transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none",
                      count > 1 ? "size-7 text-xs" : "size-4",
                      isActive && "scale-125 group-hover:scale-125",
                    )}
                    aria-hidden
                  >
                    {count > 1 ? count : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function SelectedPlace({ item }: { item: Experience }) {
  const browse = useBrowseCopy();
  const copy = useHomeCopy();
  return (
    <LocaleLink
      href={`/experiences/${item.slug}`}
      className={cn(
        "group grid grid-cols-[6rem_1fr] items-center gap-4 rounded-[1.25rem] border border-border-subtle bg-surface-raised p-3 transition-[border-color,box-shadow] duration-200 hover:border-brand/25 hover:shadow-[0_14px_30px_-22px_rgb(18_53_47/0.45)] sm:grid-cols-[7.5rem_1fr]",
        focusRing,
      )}
    >
      <span className="relative block aspect-square overflow-hidden rounded-[0.875rem] bg-brand-subtle">
        <CatalogImage
          src={item.image}
          alt={item.imageAlt}
          areaLabel={item.imageIsArea ? browse.areaPhoto : undefined}
          className="transition-transform duration-[250ms] ease-standard group-hover:scale-[1.04]"
        />
      </span>
      <span className="grid min-w-0 gap-1">
        <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-text-muted">
          <MapPin className="size-3.5 shrink-0 text-accent" aria-hidden />
          <span className="truncate">{item.placeLabel}</span>
        </span>
        <span className="text-pretty text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em] text-text">
          <BidiText>{item.title}</BidiText>
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
          {copy.cardViewDetails}
          <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
        </span>
      </span>
    </LocaleLink>
  );
}
