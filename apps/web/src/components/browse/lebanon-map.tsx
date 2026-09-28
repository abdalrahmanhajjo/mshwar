"use client";

import { useEffect, useRef } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Experience } from "@/lib/catalog";
import { listingCoordinates } from "@/lib/listing-coordinates";

/**
 * OpenFreeMap: free vector tiles built from OpenStreetMap, with no API key, no usage
 * limits and no cookies. The light "positron" style keeps the brand colours readable.
 */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const LEBANON_CENTRE: [number, number] = [35.86, 33.87];
// A little beyond the border so coastal and border towns are never cut off.
const LEBANON_BOUNDS: [[number, number], [number, number]] = [
  [34.9, 32.85],
  [37.0, 34.85],
];
const CEDAR = "#12352F";
const ORANGE = "#F3653E";

function toGeoJson(items: Experience[]) {
  return {
    type: "FeatureCollection" as const,
    features: items.flatMap((item) => {
      const point = listingCoordinates(item);
      if (!point) return [];
      return [
        {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
          properties: { slug: item.slug, title: item.title },
        },
      ];
    }),
  };
}

/**
 * The interactive map of Lebanon. Places cluster when zoomed out; a click on a cluster
 * zooms in, a click on a place selects it. MapLibre is loaded only when the map is shown.
 */
export function LebanonMap({
  items,
  active,
  onSelect,
  onError,
  label,
}: {
  items: Experience[];
  active: string | null;
  onSelect: (slug: string) => void;
  onError: () => void;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  // The map's own event handlers read the newest props through this ref.
  const latest = useRef({ items, onSelect, onError });
  useEffect(() => {
    latest.current = { items, onSelect, onError };
  });

  useEffect(() => {
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    (async () => {
      try {
        // MapLibre 6 is an ES module with named exports only.
        const { Map, NavigationControl, getVersion, setWorkerUrl } = await import("maplibre-gl");
        // The worker is served from our own origin (scripts/copy-maplibre-worker.mjs).
        setWorkerUrl(`/vendor/maplibre/${getVersion()}/maplibre-gl-worker.mjs`);
        if (cancelled || !container.current) return;
        instance = new Map({
          container: container.current,
          style: MAP_STYLE_URL,
          center: LEBANON_CENTRE,
          zoom: 7.3,
          minZoom: 6.5,
          maxBounds: LEBANON_BOUNDS,
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.current = instance;
        instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
        instance.on("error", (event) => {
          // A missing tile is not fatal; only a style that cannot load is.
          if (!instance?.isStyleLoaded() && !ready.current) {
            console.warn("map failed to load", event.error);
            latest.current.onError();
          }
        });
        instance.on("load", () => {
          if (!instance) return;
          ready.current = true;
          instance.addSource("places", {
            type: "geojson",
            data: toGeoJson(latest.current.items),
            cluster: true,
            clusterRadius: 42,
            clusterMaxZoom: 13,
          });
          instance.addLayer({
            id: "clusters",
            type: "circle",
            source: "places",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": CEDAR,
              "circle-radius": ["step", ["get", "point_count"], 17, 10, 21, 50, 26],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#FCFBF7",
            },
          });
          instance.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "places",
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": ["Noto Sans Bold"],
              "text-size": 13,
            },
            paint: { "text-color": "#FCFBF7" },
          });
          instance.addLayer({
            id: "places",
            type: "circle",
            source: "places",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": ORANGE,
              "circle-radius": ["case", ["==", ["get", "slug"], ""], 11, 8],
              "circle-stroke-width": 3,
              "circle-stroke-color": "#FFFFFF",
            },
          });
          instance.on("click", "clusters", async (event: MapLayerMouseEvent) => {
            const feature = event.features?.[0];
            const source = instance?.getSource("places") as GeoJSONSource | undefined;
            if (!feature || !source || feature.geometry.type !== "Point") return;
            const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id as number);
            instance?.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
          });
          instance.on("click", "places", (event: MapLayerMouseEvent) => {
            const slug = event.features?.[0]?.properties.slug as string | undefined;
            if (slug) latest.current.onSelect(slug);
          });
          for (const layer of ["clusters", "places"]) {
            instance.on("mouseenter", layer, () => instance && (instance.getCanvas().style.cursor = "pointer"));
            instance.on("mouseleave", layer, () => instance && (instance.getCanvas().style.cursor = ""));
          }
          fitToItems(instance, latest.current.items);
        });
      } catch (error) {
        // No WebGL, blocked tiles or an old browser: the list stays usable on its own.
        console.warn("map unavailable", error);
        if (!cancelled) latest.current.onError();
      }
    })();
    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
      ready.current = false;
    };
  }, []);

  // New results: redraw the points and frame them.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready.current) return;
    (instance.getSource("places") as GeoJSONSource | undefined)?.setData(toGeoJson(items));
    fitToItems(instance, items);
  }, [items]);

  // The selected place is drawn larger and brought into view.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready.current) return;
    instance.setPaintProperty("places", "circle-radius", ["case", ["==", ["get", "slug"], active ?? ""], 12, 8]);
    const item = items.find((entry) => entry.slug === active);
    const point = item ? listingCoordinates(item) : null;
    if (point) instance.easeTo({ center: [point.lng, point.lat], zoom: Math.max(instance.getZoom(), 14) });
  }, [active, items]);

  return (
    <div
      ref={container}
      data-map-root
      role="region"
      aria-label={label}
      className="h-[460px] w-full overflow-hidden rounded-[1.5rem] border border-border-subtle bg-brand-subtle/40 lg:h-[560px]"
    />
  );
}

function fitToItems(instance: MapLibreMap, items: Experience[]) {
  const points = items.map(listingCoordinates).filter((point): point is { lat: number; lng: number } => Boolean(point));
  const [first] = points;
  if (!first) return;
  if (points.length === 1) {
    instance.easeTo({ center: [first.lng, first.lat], zoom: 11 });
    return;
  }
  const lngs = points.map((point) => point.lng);
  const lats = points.map((point) => point.lat);
  instance.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 60, maxZoom: 12, duration: 600 },
  );
}
