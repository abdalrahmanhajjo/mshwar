import type { Map as MapLibreMap, MapOptions } from "maplibre-gl";

/** OpenFreeMap: OpenStreetMap vector tiles with no API key, no usage limits and no cookies. */
export const TILE_ORIGIN = "https://tiles.openfreemap.org";
/** Our own path for the tiles (a rewrite in next.config.ts), so browsers only ever talk to Mshwar. */
export const TILE_PROXY = "/map-tiles";
export const MAP_STYLE_URL = `${TILE_PROXY}/styles/positron`;

export const LEBANON_CENTRE: [number, number] = [35.86, 33.87];
// A little beyond the border so coastal and border towns are never cut off.
export const LEBANON_BOUNDS: [[number, number], [number, number]] = [
  [34.9, 32.85],
  [37.0, 34.85],
];

/** The style, its sources, glyphs and sprites all name OpenFreeMap; send each through our path instead. */
export function viaTileProxy(url: string): string {
  if (!url.startsWith(TILE_ORIGIN)) return url;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${TILE_PROXY}${url.slice(TILE_ORIGIN.length)}`;
}

/**
 * Loads MapLibre only when a map is shown and creates it on the Lebanon style. MapLibre 6 is an
 * ES module with named exports, and its worker is served from our own origin
 * (scripts/copy-maplibre-worker.mjs).
 */
export async function createLebanonMap(
  container: HTMLElement,
  options: Partial<MapOptions> = {},
): Promise<{ map: MapLibreMap; lib: typeof import("maplibre-gl") }> {
  const lib = await import("maplibre-gl");
  lib.setWorkerUrl(`/vendor/maplibre/${lib.getVersion()}/maplibre-gl-worker.mjs`);
  const map = new lib.Map({
    container,
    style: `${window.location.origin}${MAP_STYLE_URL}`,
    center: LEBANON_CENTRE,
    zoom: 7.3,
    minZoom: 6.5,
    maxBounds: LEBANON_BOUNDS,
    attributionControl: { compact: true },
    cooperativeGestures: true,
    transformRequest: (url) => ({ url: viaTileProxy(url) }),
    ...options,
  });
  map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
  return { map, lib };
}
