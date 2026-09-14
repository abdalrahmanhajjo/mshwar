export type StartLocation = {
  lat: number;
  lng: number;
  label: string;
  source: "search" | "pin" | "device" | "manual";
};

export type PlaceHit = {
  label: string;
  lat: number;
  lng: number;
  source: string;
  place_id: string;
};

export type RouteLeg = {
  available: boolean;
  provider: string;
  source: string;
  distance_m: number | null;
  duration_seconds: number | null;
  presented_as: string;
  cache_hit: boolean;
  time_bucket: string;
};

export type OrderedStop = {
  id: string;
  label: string;
  position: number;
  locked: boolean;
  arrives_at: string | null;
  weather_sensitivity: string;
};

export type OptimizeResult = {
  feasible: boolean;
  reason: string | null;
  solver: string;
  fallback: boolean;
  ordered_stops: OrderedStop[];
  legs: RouteLeg[];
  total_distance_m: number | null;
  total_duration_seconds: number | null;
  metrics_available: boolean;
  routing_cost: { elements_requested: number; cache_hits: number; estimated_usd_micros: number };
};

export type WeatherWarning = {
  stop_id: string;
  stop_label: string;
  severity: string;
  reasons: string[];
  source: string;
  fetched_at: string | null;
  forecast_date: string;
};

export type WarningResult = {
  warnings: WeatherWarning[];
  forecast_unavailable: boolean;
  bookings_mutated: boolean;
  booking_statuses: Record<string, string>;
};

export type ReplanResult = {
  feasible: boolean;
  applied: boolean;
  message: string;
  before: OptimizeResult | null;
  after: OptimizeResult | null;
  diff: { removed: string[]; added: string[]; unchanged: string[]; time_delta_seconds: number | null } | null;
  bookings_mutated: boolean;
};

export type PlanStop = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  duration_minutes: number;
  locked?: boolean;
  position?: number;
  weather_sensitivity?: string;
  estimated_minor?: number;
};

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string") {
      return body.detail;
    }
  } catch {
    /* ignore */
  }
  return "authError";
}

async function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "include", ...init });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as T;
}

export function samplePlan(start: StartLocation) {
  const windowStart = new Date(Date.UTC(2026, 8, 14, 8, 0, 0));
  const returnBy = new Date(Date.UTC(2026, 8, 14, 18, 0, 0));
  return {
    start: { lat: start.lat, lng: start.lng, label: start.label },
    window_start: windowStart.toISOString(),
    return_by: returnBy.toISOString(),
    plan_id: "demo-plan",
    stops: [
      {
        id: "downtown",
        lat: 33.896,
        lng: 35.506,
        label: "Downtown Beirut",
        duration_minutes: 45,
        locked: true,
        position: 1,
        weather_sensitivity: "indoor",
        estimated_minor: 2500,
      },
      {
        id: "hike",
        lat: 34.2438,
        lng: 36.0483,
        label: "Cedars of God",
        duration_minutes: 90,
        weather_sensitivity: "weather-sensitive",
        estimated_minor: 0,
      },
      {
        id: "cafe",
        lat: 33.8903,
        lng: 35.4704,
        label: "Raouche corniche",
        duration_minutes: 40,
        weather_sensitivity: "outdoor",
        estimated_minor: 1800,
      },
    ] satisfies PlanStop[],
  };
}

export function searchPlaces(q: string): Promise<PlaceHit[]> {
  return readJson(`/api/v1/locations/autocomplete?q=${encodeURIComponent(q)}`);
}

export function reversePlace(lat: number, lng: number): Promise<PlaceHit> {
  return readJson(`/api/v1/locations/reverse?lat=${lat}&lng=${lng}`);
}

export function saveStartLocation(
  input: StartLocation & { save_as_default?: boolean },
): Promise<{ preferences: { start_location: StartLocation | null } }> {
  return readJson("/api/v1/locations/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, save_as_default: input.save_as_default ?? true }),
  });
}

export function optimizePlan(plan: ReturnType<typeof samplePlan>): Promise<OptimizeResult> {
  return readJson("/api/v1/planner/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  });
}

export function evaluatePlanWarnings(stops: PlanStop[], date = "2026-09-14"): Promise<WarningResult> {
  return readJson("/api/v1/planner/warnings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      booking_statuses: { "demo-booking": "confirmed" },
      stops: stops.map((stop) => ({
        id: stop.id,
        label: stop.label,
        lat: stop.lat,
        lng: stop.lng,
        forecast_date: date,
        weather_sensitivity: stop.weather_sensitivity ?? "outdoor",
      })),
    }),
  });
}

export function replanPlan(plan: ReturnType<typeof samplePlan>, affected: string[]): Promise<ReplanResult> {
  return readJson("/api/v1/planner/replan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plan,
      affected_stop_ids: affected,
      booking_statuses: { "demo-booking": "confirmed" },
      candidates: [
        {
          id: "museum",
          lat: 33.8955,
          lng: 35.5055,
          label: "National Museum",
          duration_minutes: 70,
          weather_sensitivity: "indoor",
          estimated_minor: 2000,
        },
      ],
    }),
  });
}

export async function fetchWeatherThresholds(): Promise<
  { key: string; value_numeric: number; applies_to: string; unit: string }[]
> {
  const rows = await readJson<unknown>("/api/v1/admin/weather-thresholds");
  return Array.isArray(rows)
    ? (rows as { key: string; value_numeric: number; applies_to: string; unit: string }[])
    : [];
}

export function saveWeatherThreshold(key: string, value_numeric: number): Promise<unknown> {
  return readJson("/api/v1/admin/weather-thresholds", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value_numeric }),
  });
}
