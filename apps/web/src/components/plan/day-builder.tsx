"use client";

import * as React from "react";
import { Check, ChevronLeft, Clock, Loader2, MapPin, Plus, Search } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { DayPanel } from "@/components/plan/day-panel";
import type { ManualPreview } from "@/lib/planner";
import type { PlannerCopy } from "@/lib/planner-copy";
import type { Destination, Experience } from "@/lib/catalog";
import { interpolate } from "@/i18n/catalogues";
import { cn, focusRing } from "@/lib/utils";

const ALL_TOWNS = "__all__";

function PlaceCard({
  place,
  added,
  copy,
  onToggle,
}: {
  place: Experience;
  added: boolean;
  copy: PlannerCopy;
  onToggle: (place: Experience) => void;
}) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] overflow-hidden rounded-card border bg-surface-raised shadow-sm transition-colors sm:grid-cols-1 sm:grid-rows-[auto_1fr]",
        added ? "border-brand ring-1 ring-brand/30" : "border-border-subtle",
      )}
    >
      <span className="relative block h-full min-h-28 overflow-hidden sm:aspect-[16/10] sm:h-auto sm:min-h-0">
        <CatalogImage src={place.image} alt={place.imageAlt} />
      </span>
      <div className="grid min-w-0 content-start gap-1.5 p-3 sm:gap-2 sm:p-4">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{place.placeLabel}</span>
        </span>
        <span className="title-card break-words text-base leading-snug sm:text-[1.1rem]">{place.title}</span>
        {place.hours ? (
          <span className="inline-flex items-center gap-1 text-xs text-text-muted">
            <Clock className="size-3 shrink-0" aria-hidden />
            {interpolate(copy.flowPlaceHours, { n: place.hours })}
          </span>
        ) : null}
        <span className="hidden text-sm text-text-muted sm:line-clamp-2">{place.summary}</span>
        <Button
          type="button"
          size="sm"
          variant={added ? "outline" : "default"}
          className="mt-auto w-full sm:w-fit"
          aria-pressed={added}
          onClick={() => onToggle(place)}
        >
          {added ? (
            <>
              <Check aria-hidden />
              {copy.flowPickAdded}
            </>
          ) : (
            <>
              <Plus aria-hidden />
              {copy.flowPickAdd}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Pick places and watch the day take shape.
 *
 * The catalogue and the day sit side by side from `lg` up, so adding a stop and
 * seeing what it does to the driving is one glance rather than a scroll. On a
 * phone the day collapses behind a toggle that carries the running count.
 */
export function DayBuilder({
  places,
  loading,
  picks,
  towns,
  preview,
  checking,
  failed = false,
  notice,
  copy,
  locale,
  onToggle,
  onMove,
  onReorder,
  onSplit,
  onClear,
  onBack,
  action,
}: {
  places: Experience[];
  loading: boolean;
  picks: Experience[];
  towns: Destination[];
  preview: ManualPreview | null;
  checking: boolean;
  failed?: boolean;
  /** Shown above the grid, e.g. when an AI plan is being edited by hand. */
  notice?: React.ReactNode;
  copy: PlannerCopy;
  locale: string;
  onToggle: (place: Experience) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onReorder: (slugs: string[]) => void;
  onSplit: (slugs: string[]) => void;
  onClear: () => void;
  onBack: () => void;
  /** The step's primary action. The builder shows it; the flow decides what it does. */
  action: React.ReactNode;
}) {
  const [town, setTown] = React.useState<string>(ALL_TOWNS);
  const [dayOpen, setDayOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const pickedSlugs = new Set(picks.map((item) => item.slug));
  const needle = query.trim().toLocaleLowerCase();
  const inTown = town === ALL_TOWNS ? places : places.filter((place) => place.destinationSlug === town);
  const shown = needle
    ? inTown.filter((place) =>
        `${place.title} ${place.placeLabel} ${place.summary}`.toLocaleLowerCase().includes(needle),
      )
    : inTown;
  const tabs = [{ slug: ALL_TOWNS, name: copy.flowAllDestinations }, ...towns];

  return (
    <section aria-labelledby="pf-places" className="grid gap-6">
      <div className="grid gap-2">
        <h2 id="pf-places" className="title-section">
          {copy.flowPickTitle}
        </h2>
        <p className="max-w-2xl text-text-muted">{copy.flowPickHint}</p>
      </div>

      {notice}

      {towns.length > 1 ? (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-text-muted">{copy.flowFilterTown}</span>
          {/* Scrolls instead of widening the page when the town names outgrow a phone. */}
          <div
            role="group"
            aria-label={copy.flowFilterTown}
            className="scrollbar-hide inline-flex min-w-0 max-w-full gap-1 overflow-x-auto rounded-pill border border-border-subtle bg-surface-raised p-1"
          >
            {tabs.map((item) => (
              <button
                key={item.slug}
                type="button"
                aria-pressed={town === item.slug}
                onClick={() => setTown(item.slug)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-pill px-4 text-sm font-medium transition-colors",
                  town === item.slug ? "bg-brand text-white" : "text-text-muted hover:bg-surface-sunken",
                  focusRing,
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* On a phone the day is one tap away rather than a scroll past the grid. */}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between lg:hidden"
        aria-expanded={dayOpen}
        aria-controls="day-rail"
        onClick={() => setDayOpen((value) => !value)}
      >
        <span>{dayOpen ? copy.dayPanelHide : copy.dayPanelShow}</span>
        <Badge variant="secondary">{interpolate(copy.dayStopsCount, { n: picks.length })}</Badge>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid min-w-0 gap-4">
          {places.length > 6 ? (
            <label className="relative block">
              <span className="sr-only">{copy.flowPickSearch}</span>
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                placeholder={copy.flowPickSearch}
                className="ps-9"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          ) : null}

          {loading ? (
            <div className="grid place-items-center gap-2 py-16 text-text-muted">
              <Loader2 className="size-6 animate-spin" aria-hidden />
            </div>
          ) : shown.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((place) => (
                <PlaceCard
                  key={place.slug}
                  place={place}
                  added={pickedSlugs.has(place.slug)}
                  copy={copy}
                  onToggle={onToggle}
                />
              ))}
            </div>
          ) : (
            <Notice role="status">
              {needle && inTown.length ? interpolate(copy.flowPickNoMatch, { q: query.trim() }) : copy.flowPickEmpty}
            </Notice>
          )}
        </div>

        <div
          id="day-rail"
          className={cn(
            "order-first min-w-0 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-sm md:p-5 lg:sticky lg:top-24 lg:order-none lg:block",
            dayOpen ? "block" : "hidden",
          )}
        >
          <DayPanel
            picks={picks}
            preview={preview}
            checking={checking}
            failed={failed}
            copy={copy}
            locale={locale}
            onMove={onMove}
            onRemove={onToggle}
            onReorder={onReorder}
            onSplit={onSplit}
            onClear={onClear}
          />
        </div>
      </div>

      {/* Stays in reach on a phone, where the grid of places is long. */}
      <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-subtle bg-surface/95 p-3 shadow-md backdrop-blur sm:static sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-none">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
          {copy.flowBack}
        </Button>
        {action}
      </div>
    </section>
  );
}
