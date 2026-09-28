import { LEBANON_BOUNDS } from "@/lib/maplibre";

export type RouteLine =
  | {
      available: true;
      /** [lng, lat] along the roads. */
      coordinates: [number, number][];
      distance_m: number;
      /** Typical drive time, without live traffic. */
      duration_s: number;
      legs: { distance_m: number; duration_s: number }[];
    }
  | { available: false };

export const MAX_ROUTE_POINTS = 25;

/** "lng,lat;lng,lat" → points, or null unless there are 2–25 valid points in and around Lebanon. */
export function parseRoutePoints(raw: string | null): [number, number][] | null {
  if (!raw) return null;
  const parts = raw.split(";");
  if (parts.length < 2 || parts.length > MAX_ROUTE_POINTS) return null;
  const [[west, south], [east, north]] = LEBANON_BOUNDS;
  const points: [number, number][] = [];
  for (const part of parts) {
    const [lng, lat, extra] = part.split(",").map((value) => Number(value));
    if (extra !== undefined || lng === undefined || lat === undefined) return null;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (lng < west || lng > east || lat < south || lat > north) return null;
    // Five decimals is about a metre: enough for a road route, and it keeps cache keys stable.
    points.push([Number(lng.toFixed(5)), Number(lat.toFixed(5))]);
  }
  return points;
}

export function routeQuery(points: [number, number][]): string {
  return points.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(";");
}

export async function fetchRoadRoute(points: [number, number][], signal?: AbortSignal): Promise<RouteLine> {
  if (points.length < 2) return { available: false };
  try {
    const response = await fetch(`/map-route?points=${encodeURIComponent(routeQuery(points))}`, { signal });
    if (!response.ok) return { available: false };
    return (await response.json()) as RouteLine;
  } catch {
    return { available: false };
  }
}

/**
 * Google Maps directions for the whole day, starting from wherever the traveller is: the app
 * shows live traffic and navigates. Maps URLs need no key. Google accepts up to 9 waypoints.
 */
export function googleDirectionsUrl(stops: { lat: number; lng: number }[]): string | null {
  // A longer day hands over its first ten stops.
  const shown = stops.slice(0, 10);
  const last = shown.at(-1);
  if (!last) return null;
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${last.lat},${last.lng}`);
  const waypoints = shown.slice(0, -1);
  if (waypoints.length) url.searchParams.set("waypoints", waypoints.map((stop) => `${stop.lat},${stop.lng}`).join("|"));
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

/** Waze, popular in Lebanon, navigates to one place at a time with live traffic. */
export function wazeUrl(stop: { lat: number; lng: number }): string {
  return `https://waze.com/ul?ll=${stop.lat},${stop.lng}&navigate=yes`;
}
