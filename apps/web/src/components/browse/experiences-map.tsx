"use client";

import { useMemo, useState } from "react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { SaveExperienceButton } from "@/components/browse/save-button";
import { BidiText } from "@/components/ui/bidi-text";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { listingCoordinates } from "@/lib/catalogue-api";
import type { Experience } from "@/lib/catalog";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function clusterBeirut(items: Experience[]) {
  const beirut = items.filter((item) => item.destinationSlug === "beirut");
  const others = items.filter((item) => item.destinationSlug !== "beirut");
  return { beirut, others };
}

export function ExperiencesMap({
  items,
  onSearchArea,
}: {
  items: Experience[];
  onSearchArea: (destination?: string) => void;
}) {
  const copy = useBrowseCopy();
  const [active, setActive] = useState<string | null>(null);
  const selected = items.find((item) => item.slug === active) ?? null;
  const { beirut, others } = useMemo(() => clusterBeirut(items), [items]);
  const failed = !MAPS_KEY;

  if (failed) {
    return (
      <div className="grid gap-4">
        <p className="rounded-card border border-border bg-surface-sunken px-4 py-3 text-sm text-text-muted">
          {copy.mapUnavailable}
        </p>
        <div
          className="relative min-h-[320px] overflow-hidden rounded-card border border-border bg-surface-sunken"
          role="img"
          aria-label={copy.mapView}
        >
          <div className="absolute inset-6 grid grid-cols-3 gap-3">
            {beirut.length ? (
              <button
                type="button"
                className="rounded-pill bg-brand px-3 py-2 text-sm text-brand-foreground"
                onClick={() => onSearchArea("beirut")}
              >
                {copy.clusterLabel} <BidiText>Beirut</BidiText> · {beirut.length}
              </button>
            ) : null}
            {others.map((item) => {
              const point = listingCoordinates(item);
              return (
                <button
                  key={item.slug}
                  type="button"
                  className="h-fit rounded-pill bg-surface px-3 py-2 text-start text-sm shadow-sm"
                  style={{ marginTop: point ? `${(34.4 - point.lat) * 40}px` : undefined }}
                  onClick={() => setActive(item.slug)}
                >
                  <BidiText>{item.title}</BidiText>
                </button>
              );
            })}
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onSearchArea()}>
          {copy.searchThisArea}
        </Button>
        {selected ? (
          <div className="max-w-sm">
            <ExperienceCard experience={selected} compact />
          </div>
        ) : null}
      </div>
    );
  }

  const src = `https://www.google.com/maps/embed/v1/view?key=${MAPS_KEY}&center=33.89,35.50&zoom=8`;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <div className="grid gap-3">
        <iframe title={copy.mapView} src={src} className="min-h-[360px] w-full rounded-card border-0" />
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <Button key={item.slug} type="button" size="sm" variant="outline" onClick={() => setActive(item.slug)}>
              {item.title}
            </Button>
          ))}
          <Button type="button" size="sm" onClick={() => onSearchArea()}>
            {copy.searchThisArea}
          </Button>
        </div>
      </div>
      {selected ? (
        <div className="grid gap-3">
          <SaveExperienceButton slug={selected.slug} />
          <ExperienceCard experience={selected} compact />
        </div>
      ) : null}
    </div>
  );
}
