import type { NextRequest } from "next/server";
import { parseRoutePoints, type RouteLine } from "@/lib/road-route";
import { osrmUrl } from "@/lib/server-env";

/**
 * Road routes between a plan's stops, drawn on the plan map. It asks an OSRM server (the public
 * OpenStreetMap one by default; set OSRM_URL to your own for heavy use) for a driving route
 * along real roads, so the browser never talks to a third party and no key is needed. Routes are
 * cached for a day. Times are typical drive times, not live traffic.
 */
const DAY_SECONDS = 60 * 60 * 24;

const unavailable = (status = 200) =>
  Response.json({ available: false } satisfies RouteLine, {
    status,
    headers: { "Cache-Control": "public, max-age=300" },
  });

export async function GET(request: NextRequest) {
  const points = parseRoutePoints(request.nextUrl.searchParams.get("points"));
  if (!points) return unavailable(400);

  const path = points.map(([lng, lat]) => `${lng},${lat}`).join(";");
  try {
    const response = await fetch(`${osrmUrl()}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`, {
      headers: { "User-Agent": "Mshwar trip planner (https://mshwarlb.com)" },
      next: { revalidate: DAY_SECONDS },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return unavailable();
    const data = (await response.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: { type: "LineString"; coordinates: [number, number][] };
        legs: { distance: number; duration: number }[];
      }[];
    };
    const route = data.code === "Ok" ? data.routes?.[0] : undefined;
    if (!route || route.geometry?.type !== "LineString") return unavailable();
    const body: RouteLine = {
      available: true,
      coordinates: route.geometry.coordinates,
      distance_m: Math.round(route.distance),
      duration_s: Math.round(route.duration),
      legs: route.legs.map((leg) => ({ distance_m: Math.round(leg.distance), duration_s: Math.round(leg.duration) })),
    };
    return Response.json(body, { headers: { "Cache-Control": `public, max-age=${DAY_SECONDS}` } });
  } catch {
    // Routing is a nicety: the map falls back to straight lines between stops.
    return unavailable();
  }
}
