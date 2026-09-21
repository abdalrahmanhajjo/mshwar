"use client";

import * as React from "react";
import { Check, ChevronLeft, Loader2, MapPin, Plus } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        "grid overflow-hidden rounded-card border bg-surface-raised shadow-sm transition-colors",
        added ? "border-brand ring-1 ring-brand/30" : "border-border-subtle",
      )}
    >
      <span className="relative block aspect-[16/10] overflow-hidden">
        <CatalogImage src={place.image} alt={place.imageAlt} />
      </span>
      <div className="grid gap-2 p-4">
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {place.placeLabel}
        </span>
        <span className="title-card text-[1.1rem] leading-snug">{place.title}</span>
        <span className="line-clamp-2 text-sm text-text-muted">{place.summary}</span>
        <Button
          type="button"
          size="sm"
          variant={added ? "outline" : "default"}
          className="mt-1 w-fit"
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
  const pickedSlugs = new Set(picks.map((item) => item.slug));
  const shown = town === ALL_TOWNS ? places : places.filter((place) => place.destinationSlug === town);
  const tabs = [{ slug: ALL_TOWNS, name: copy.flowAllDestinations }, ...towns];

  return (
    <section aria-labelledby="pf-places" className="grid gap-6">
      <div className="grid gap-2">
        <h2 id="pf-places" className="title-section">
          {copy.flowPickTitle}
        </h2>
        <p className="max-w-2xl text-text-muted">{copy.flowPickHint}</p>
      </div>

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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="grid min-w-0 gap-4">
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
            <Notice role="status">{copy.flowPickEmpty}</Notice>
          )}
        </div>

        <div
          id="day-rail"
          className={cn(
            "rounded-card border border-border-subtle bg-surface-raised p-4 shadow-sm md:p-5 lg:sticky lg:top-24 lg:block",
            dayOpen ? "block" : "hidden",
          )}
        >
          <DayPanel
            picks={picks}
            preview={preview}
            checking={checking}
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
          {copy.flowBack}
        </Button>
        {action}
      </div>
    </section>
  );
}
