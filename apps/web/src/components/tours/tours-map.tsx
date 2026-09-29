"use client";

import * as React from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useLocale } from "@/components/shell/locale-provider";
import { Notice } from "@/components/ui/notice";
import { withLocalePrefix } from "@/lib/locale";
import { createLebanonMap } from "@/lib/maplibre";
import type { TourCard } from "@/lib/tour-booking";
import { useToursCopy } from "@/lib/tours-copy";

/**
 * Tours on the keyless map of Lebanon, one pin per meeting point. A pin opens the tour. The
 * list stays on the page, so the map is a help, never the only way to a tour.
 */
export function ToursMap({ tours }: { tours: TourCard[] }) {
  const copy = useToursCopy();
  const { locale } = useLocale();
  const container = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState(false);
  const pinned = React.useMemo(
    () => tours.filter((tour) => typeof tour.lat === "number" && typeof tour.lng === "number"),
    [tours],
  );

  React.useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    const markers: Marker[] = [];
    (async () => {
      try {
        if (!container.current) return;
        const { map, lib } = await createLebanonMap(container.current);
        instance = map;
        if (cancelled) {
          map.remove();
          return;
        }
        for (const tour of pinned) {
          const link = document.createElement("a");
          link.href = withLocalePrefix(locale, `/tours/${tour.slug}`);
          link.title = tour.title;
          link.setAttribute("aria-label", tour.title);
          link.className =
            "grid size-8 place-items-center rounded-full border-2 border-white bg-[#F3653E] text-[13px] font-semibold text-white shadow-[0_6px_14px_-4px_rgb(0_0_0/0.45)]";
          link.textContent = "●";
          markers.push(
            new lib.Marker({ element: link }).setLngLat([tour.lng as number, tour.lat as number]).addTo(map),
          );
        }
        if (pinned.length > 1) {
          const lngs = pinned.map((tour) => tour.lng as number);
          const lats = pinned.map((tour) => tour.lat as number);
          map.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: 48, maxZoom: 12, duration: 0 },
          );
        } else if (pinned.length === 1) {
          map.easeTo({ center: [pinned[0].lng as number, pinned[0].lat as number], zoom: 11, duration: 0 });
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      for (const marker of markers) marker.remove();
      instance?.remove();
    };
  }, [pinned, locale]);

  if (failed) {
    return <Notice tone="warning">{copy.mapError}</Notice>;
  }
  return (
    <div
      ref={container}
      role="region"
      aria-label={copy.mapLabel}
      className="h-[26rem] w-full overflow-hidden rounded-card border border-border-subtle bg-surface-sunken"
    />
  );
}
