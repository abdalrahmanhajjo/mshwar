"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { LebanonMap } from "@/components/browse/lebanon-map";
import { BidiText } from "@/components/ui/bidi-text";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useCookieChoices } from "@/components/legal/cookie-consent-state";
import { ESSENTIAL_ONLY, writeCookieChoices } from "@/lib/cookie-consent";
import { useTrustCopy } from "@/lib/trust-copy";
import { cn, focusRing } from "@/lib/utils";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Experience } from "@/lib/catalog";

/**
 * Map view of the experiences list. The map is OpenStreetMap data served by OpenFreeMap
 * through MapLibre, so it needs no API key. It still loads only once maps are allowed
 * (MSHWAR-113): the tiles come from a third party. The list beside it works with or
 * without the map, and by keyboard.
 */
export function ExperiencesMap({
  items,
  onSearchArea,
}: {
  items: Experience[];
  onSearchArea: (destination?: string) => void;
}) {
  const copy = useBrowseCopy();
  const trust = useTrustCopy();
  const choices = useCookieChoices();
  const [active, setActive] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const selected = items.find((item) => item.slug === active) ?? null;
  const blocked = !choices?.maps;

  return (
    <div className="grid gap-4">
      {blocked ? (
        <Notice>
          <p className="font-semibold text-text">{trust.mapOffTitle}</p>
          <p>{trust.mapOffBody}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => writeCookieChoices({ ...(choices ?? ESSENTIAL_ONLY), maps: true })}
          >
            {trust.mapAllow}
          </Button>
        </Notice>
      ) : failed ? (
        <Notice>{copy.mapUnavailable}</Notice>
      ) : null}

      <div className={cn("grid gap-4", !blocked && !failed && "lg:grid-cols-[1fr_20rem]")}>
        {!blocked && !failed ? (
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
