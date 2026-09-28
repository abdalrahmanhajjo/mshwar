"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { LebanonMap } from "@/components/browse/lebanon-map";
import { BidiText } from "@/components/ui/bidi-text";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { cn, focusRing } from "@/lib/utils";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Experience } from "@/lib/catalog";

/**
 * Map view of the experiences list. The map is OpenStreetMap data from OpenFreeMap through
 * MapLibre: no API key, and the tiles come through Mshwar's own origin, so the browser never
 * contacts a third party and no cookie choice is needed (MSHWAR-113 covers third-party embeds).
 * The list beside it works with or without the map, and by keyboard.
 */
export function ExperiencesMap({
  items,
  onSearchArea,
}: {
  items: Experience[];
  onSearchArea: (destination?: string) => void;
}) {
  const copy = useBrowseCopy();
  const [active, setActive] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const selected = items.find((item) => item.slug === active) ?? null;

  return (
    <div className="grid gap-4">
      {failed ? <Notice>{copy.mapUnavailable}</Notice> : null}

      <div className={cn("grid gap-4", !failed && "lg:grid-cols-[1fr_20rem]")}>
        {!failed ? (
          <LebanonMap
            items={items}
            active={active}
            onSelect={setActive}
            onError={() => setFailed(true)}
            label={copy.mapView}
          />
        ) : null}

        <div className="grid content-start gap-3">
          {selected ? <ExperienceCard experience={selected} compact /> : null}
          <ul className="grid max-h-[360px] gap-1.5 overflow-y-auto pe-1 lg:max-h-[560px]">
            {items.map((item) => (
              <li key={item.slug}>
                <button
                  type="button"
                  aria-pressed={active === item.slug}
                  onClick={() => setActive(item.slug)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2.5 rounded-[0.75rem] border px-3 py-2 text-start text-sm transition-colors",
                    active === item.slug
                      ? "border-brand bg-brand-subtle font-semibold text-text"
                      : "border-border-subtle bg-surface-raised text-text hover:border-brand/40",
                    focusRing,
                  )}
                >
                  <MapPin className="size-4 shrink-0 text-accent" strokeWidth={1.8} aria-hidden />
                  <span className="grid min-w-0">
                    <span className="truncate">
                      <BidiText>{item.title}</BidiText>
                    </span>
                    <span className="truncate text-xs font-normal text-text-muted">{item.placeLabel}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onSearchArea()}>
            {copy.searchThisArea}
          </Button>
        </div>
      </div>
    </div>
  );
}
