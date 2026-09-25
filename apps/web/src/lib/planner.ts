import { apiRequest } from "@/lib/api/client";

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

export type DemoPlanStop = {
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

function readJson<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(path, { ...init, fallbackMessage: "authError" });
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
    ] satisfies DemoPlanStop[],
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

export function evaluatePlanWarnings(stops: DemoPlanStop[], date = "2026-09-14"): Promise<WarningResult> {
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

export type AssumedDefault = {
  field: string;
  value: unknown;
  label: string;
};

export type Clarification = {
  field: string;
  prompt: string;
  required: boolean;
};

export type PlanStop = {
  id: string;
  experience_id: string;
  position: number;
  starts_at: string;
  ends_at: string;
  estimated_minor: number;
  price_kind: string;
  locked: boolean;
  snapshot: {
    title?: string;
    slug?: string;
    destination_slug?: string;
    explanation?: string;
    flags?: string[];
    price_source?: string;
    sponsored?: boolean;
    sponsored_label?: string | null;
  };
  slug?: string;
  title?: string;
  booking_mode?: string;
  image?: string | null;
  image_alt?: string | null;
};

export type PlanLeg = {
  id?: string;
  position: number;
  provider: string;
  distance_m: number | null;
  duration_seconds: number | null;
  estimated_minor: number;
  status: string;
};

export type CostItem = {
  kind: string;
  label: string;
  amount_minor: number;
};

export type PlanDocument = {
  trip_id: string;
  trip_title: string;
  version_id: string;
  version: number;
  origin: string;
  sealed_at: string | null;
  window_start: string;
  return_by: string;
  party_size: number;
  budget_minor: number;
  currency: string;
  strict_budget: boolean;
  constraints: Record<string, unknown>;
  validation: Record<string, unknown>;
  stops: PlanStop[];
  legs: PlanLeg[];
  cost_items: CostItem[];
  total_minor: number;
};

export type PlannerSession = {
  session_id: string;
  status: string;
  degraded: boolean;
  degraded_message: string | null;
  constraints: Record<string, unknown>;
  assumed_defaults: AssumedDefault[];
  clarifications: Clarification[];
  plan: PlanDocument | null;
  llm_never_sets_totals?: boolean;
  blocked?: { slug?: string; blocked: string[] }[];
  forced_lock_changes?: string[];
  budget_warning?: string | null;
  needs_budget_approval?: boolean;
  injection_logged?: boolean;
  explanations?: string[];
  /** A day told step by step (trip builder v2): every step, the day's price, and a driver draft. */
  day?: DayStepOutcome[];
  pricing?: DayPrice | null;
  driver_request?: Record<string, unknown> | null;
};

export type PriceBasis =
  | "fixed"
  | "free"
  | "from"
  | "range"
  | "estimated"
  | "typical_spend"
  | "per_night_from"
  | "driver_day_rate"
  | "exchange_rate"
  | "on_request";

export type PriceLine = {
  order: number | null;
  kind: "stop" | "stay" | "driver" | "exchange";
  label: string;
  basis: PriceBasis;
  unit: "person" | "group" | "night" | "day" | "visit";
  quantity: number;
  unit_low_minor: number | null;
  unit_high_minor: number | null;
  low_minor: number | null;
  high_minor: number | null;
  currency: string;
  source: string;
  note: string;
};

export type DayPrice = {
  currency: string;
  party_size: number;
  lines: PriceLine[];
  low_minor: number;
  /** null: open-ended, the day costs at least low_minor. */
  high_minor: number | null;
  per_person_low_minor: number;
  per_person_high_minor: number | null;
  priced_lines: number;
  on_request_lines: number;
  other_currency_lines: number;
  budget_minor: number | null;
  budget_status: "within" | "over" | "may_exceed" | "unknown";
};

export type DayStepOutcome = {
  order: number;
  role: string;
  status: "filled" | "office" | "empty" | "skipped";
  reason: string | null;
  title: string | null;
  starts_at: string | null;
  flags: string[];
  price: PriceLine | null;
  actions: Record<string, string>;
};

/** The day's price: from the live session, or from what the sealed version kept. */
export function dayPriceOf(session: PlannerSession | null, plan: PlanDocument | null): DayPrice | null {
  const kept = plan?.constraints?.pricing;
  return session?.pricing ?? (kept && typeof kept === "object" ? (kept as DayPrice) : null);
}

export function requestDayDriver(
  sessionId: string,
  input: { pickup_name: string; pickup_lat?: number; pickup_lng?: number; luggage?: number; notes?: string },
) {
  return readJson<{ id: string; kind: string; status: string }>(
    `/api/v1/planner/sessions/${sessionId}/driver-request`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
  );
}

export function createPlannerSession(input: {
  text: string;
  locale: string;
  session_id?: string;
  answers?: Record<string, unknown>;
  approve_budget?: boolean;
}) {
  return readJson<PlannerSession>("/api/v1/planner/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export type DayIssue = {
  code: string;
  severity: "blocking" | "warning" | "info";
  positions: number[];
  labels: string[];
  detail: Record<string, number | string>;
};

export type FeasibilityReport = {
  feasible: boolean;
  travel_minutes: number;
  travel_distance_m: number;
  day_minutes: number;
  travel_share: number;
  spread_m: number;
  destination_slugs: string[];
  issues: DayIssue[];
  suggested_order: string[];
  order_saves_minutes: number;
};

export type ManualStopTiming = {
  position: number;
  slug: string;
  title: string;
  destination_slug: string;
  destination_name: string;
  arrives_at: string;
  leaves_at: string;
  travel_minutes: number;
  travel_distance_m: number;
  travel_available: boolean;
  opens: string | null;
  closes: string | null;
  wait_minutes: number;
  flags: string[];
};

export type ManualPreview = {
  stops: ManualStopTiming[];
  feasibility: FeasibilityReport;
  suggested_days: string[][];
  total_minor: number;
  currency: string;
  budget_warning: string | null;
  infeasible_reason: string | null;
};

/** Cost and sanity-check a set of picks without saving anything. */
export function previewManualPlan(
  input: {
    experience_slugs: string[];
    destination_slugs?: string[];
    party_size?: number;
    window_start?: string;
    budget_minor?: number;
    strict_budget?: boolean;
    currency?: string;
    locale?: string;
  },
  signal?: AbortSignal,
) {
  return readJson<ManualPreview>("/api/v1/planner/manual/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
}

export function createManualPlan(input: {
  experience_slugs: string[];
  destination_slugs?: string[];
  party_size?: number;
  window_start?: string;
  budget_minor?: number;
  strict_budget?: boolean;
  currency?: string;
  title?: string;
  trip_id?: string;
  locale?: string;
  accept_warnings?: boolean;
}) {
  return readJson<PlannerSession>("/api/v1/planner/manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function clarifyPlannerSession(
  sessionId: string,
  input: { text: string; locale: string; answers?: Record<string, unknown> },
) {
  return readJson<PlannerSession>(`/api/v1/planner/sessions/${sessionId}/clarify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function lockPlannerStop(sessionId: string, stopId: string, locked: boolean) {
  return readJson<PlannerSession>(`/api/v1/planner/sessions/${sessionId}/lock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stop_id: stopId, locked }),
  });
}

export function regeneratePlannerSession(sessionId: string) {
  return readJson<PlannerSession>(`/api/v1/planner/sessions/${sessionId}/regenerate`, {
    method: "POST",
  });
}

export function fetchAlternatives(sessionId: string, stopId: string) {
  return readJson<
    {
      experience_id: string;
      slug: string;
      title: string;
      why_fit: string[];
      sponsored: boolean;
      sponsored_label: string | null;
      duration_minutes: number;
    }[]
  >(`/api/v1/planner/sessions/${sessionId}/stops/${stopId}/alternatives`);
}

export function previewReplacement(sessionId: string, stopId: string, experienceId: string) {
  return readJson<{
    preview_id: string;
    why_fit: string[];
    title: string;
    delta_cost_minor: number;
    delta_minutes: number;
    new_total_minor: number;
  }>(`/api/v1/planner/sessions/${sessionId}/replace/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stop_id: stopId, experience_id: experienceId }),
  });
}

export function acceptReplacement(sessionId: string, previewId: string) {
  return readJson<PlannerSession>(`/api/v1/planner/sessions/${sessionId}/replace/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preview_id: previewId }),
  });
}

export function cancelReplacement(sessionId: string) {
  return readJson<PlannerSession>(`/api/v1/planner/sessions/${sessionId}/replace/cancel`, {
    method: "POST",
  });
}

export function refinePlannerSession(sessionId: string, text: string, apply: boolean) {
  return readJson<PlannerSession & { understood?: boolean; summary?: string; clarification?: string }>(
    `/api/v1/planner/sessions/${sessionId}/refine`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, apply }),
    },
  );
}

export function fetchTripVersions(tripId: string) {
  return readJson<
    { version_id: string; version: number; origin: string; sealed_at: string | null; created_at: string }[]
  >(`/api/v1/planner/trips/${tripId}/versions`);
}

export function fetchVersion(versionId: string) {
  return readJson<PlanDocument>(`/api/v1/planner/versions/${versionId}`);
}

export function fetchPlannerHealth() {
  return readJson<{
    injection_events_24h: number;
    planned_sessions_24h: number;
    degraded_sessions_24h: number;
    active_ranker: string | null;
  }>("/api/v1/planner/admin/health");
}

export function fetchInjectionEvents() {
  return readJson<{ id: string; kind: string; pattern: string; excerpt: string; created_at: string }[]>(
    "/api/v1/planner/admin/injections",
  );
}

export function fetchAdminTripVersions(tripId: string) {
  return readJson<
    {
      version_id: string;
      version: number;
      origin: string;
      sealed_at: string | null;
      created_at: string;
      constraints?: Record<string, unknown>;
    }[]
  >(`/api/v1/planner/admin/trips/${tripId}/versions`);
}

export function formatMinor(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
}
