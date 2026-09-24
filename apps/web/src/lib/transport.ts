import { apiRequest } from "@/lib/api/client";

/** Checked transport cards per destination (V2). Mirrors services/api transport.py. */
export type TransportMode =
  "service_taxi" | "taxi" | "bus" | "van" | "ride_hailing" | "car_rental" | "walking" | "ferry";
export type TransportScope = "between" | "airport" | "around";
export type FareBasis = "person" | "vehicle" | "free";
export type EvidenceKind = "field_check" | "operator" | "guide_report" | "traveller_report";
export type FlagReason =
  "fare_higher" | "fare_lower" | "no_longer_runs" | "wrong_pickup" | "times_wrong" | "unsafe" | "other";

export const TRANSPORT_MODES: TransportMode[] = [
  "service_taxi",
  "taxi",
  "bus",
  "van",
  "ride_hailing",
  "car_rental",
  "walking",
  "ferry",
];

export type Stop = { name: string; lat: number | null; lng: number | null };

export type TransportCard = {
  id: string;
  scope: TransportScope;
  mode: TransportMode;
  line_name: string;
  from: { slug: string; name: string } | null;
  to: { slug: string; name: string };
  pickup: Stop;
  dropoff: Stop;
  fare: { basis: FareBasis; low_minor: number | null; high_minor: number | null; currency: string | null };
  duration: { min: number | null; max: number | null };
  frequency_minutes: number | null;
  first_departure: string | null;
  last_departure: string | null;
  runs_sunday: boolean | null;
  tips: Partial<Record<"en" | "ar" | "fr", string>>;
  step_free: boolean | null;
  night_service: boolean | null;
  luggage_ok: boolean | null;
  safety_note: string;
  checked_on: string | null;
  review_by: string | null;
  live: boolean;
};

export type Evidence = { kind: EvidenceKind; note: string; url?: string; on?: string | null };

/** What staff and the proposing guide see on top of the public card. */
export type TransportCardPrivate = TransportCard & {
  status: "submitted" | "published" | "rejected" | "retired";
  evidence: Evidence[];
  submitted_role: "staff" | "guide";
  submitted_by: string | null;
  checked_by: string | null;
  decision_reason: string;
  replaces_route_id: string | null;
  open_flags: { reason: FlagReason; details: string; at: string }[];
  created_at: string;
};

export type DestinationTransport = {
  destination: { slug: string; name: string };
  from_airport: TransportCard[];
  from_beirut: TransportCard[];
  between: TransportCard[];
  around: TransportCard[];
};

export type TransportCardInput = {
  scope: TransportScope;
  from_destination?: string | null;
  to_destination: string;
  mode: TransportMode;
  line_name?: string;
  pickup_name?: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_name?: string;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
  fare_basis: FareBasis;
  fare_low_minor?: number | null;
  fare_high_minor?: number | null;
  currency?: "USD" | "LBP" | "EUR" | null;
  duration_min?: number | null;
  duration_max?: number | null;
  frequency_minutes?: number | null;
  first_departure?: string | null;
  last_departure?: string | null;
  runs_sunday?: boolean | null;
  tips?: Partial<Record<"en" | "ar" | "fr", string>>;
  step_free?: boolean | null;
  night_service?: boolean | null;
  luggage_ok?: boolean | null;
  safety_note?: string;
  evidence: Evidence[];
  replaces_route_id?: string | null;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchDestinationTransport(slug: string) {
  return apiRequest<DestinationTransport>(`/api/v1/transport/destinations/${encodeURIComponent(slug)}`);
}

export function fetchTransportBetween(from: string, to: string) {
  const params = new URLSearchParams({ from, to });
  return apiRequest<TransportCard[]>(`/api/v1/transport/between?${params.toString()}`);
}

export function flagTransportCard(id: string, reason: FlagReason, details = "") {
  return apiRequest<{ flagged: boolean; back_to_review: boolean }>(
    `/api/v1/transport/routes/${id}/flags`,
    json("POST", { reason, details }),
  );
}

export function submitGuideTransport(input: TransportCardInput) {
  return apiRequest<TransportCardPrivate>("/api/v1/transport/guide", json("POST", input));
}

export function fetchGuideTransport() {
  return apiRequest<TransportCardPrivate[]>("/api/v1/transport/guide");
}

// ---- Staff ------------------------------------------------------------------------------------

export function fetchAdminTransport(status = "submitted", destination?: string) {
  const params = new URLSearchParams({ status });
  if (destination) {
    params.set("destination", destination);
  }
  return apiRequest<TransportCardPrivate[]>(`/api/v1/admin/transport?${params.toString()}`);
}

export function createTransportCard(input: TransportCardInput) {
  return apiRequest<TransportCardPrivate>("/api/v1/admin/transport", json("POST", input));
}

export function editTransportCard(id: string, input: TransportCardInput) {
  return apiRequest<TransportCardPrivate>(`/api/v1/admin/transport/${id}`, json("PUT", input));
}

export function decideTransportCard(
  id: string,
  body: {
    decision: "published" | "rejected" | "retired";
    checked_on?: string;
    field_check_note?: string;
    reason?: string;
  },
) {
  return apiRequest<TransportCardPrivate>(`/api/v1/admin/transport/${id}/decision`, json("POST", body));
}

/** A fare range in whole currency units, "2–4" or "2", from minor units. */
export function fareRange(card: Pick<TransportCard, "fare">): { low: number; high: number; currency: string } | null {
  const { low_minor, high_minor, currency, basis } = card.fare;
  if (basis === "free" || low_minor === null || high_minor === null || !currency) {
    return null;
  }
  // Every currency Mshwar uses (USD, EUR, LBP) has two minor digits.
  return { low: low_minor / 100, high: high_minor / 100, currency };
}

/** The input form of a card, for editing or proposing an update. */
export function cardToInput(card: TransportCardPrivate): TransportCardInput {
  return {
    scope: card.scope,
    from_destination: card.from?.slug ?? null,
    to_destination: card.to.slug,
    mode: card.mode,
    line_name: card.line_name,
    pickup_name: card.pickup.name,
    pickup_lat: card.pickup.lat,
    pickup_lng: card.pickup.lng,
    dropoff_name: card.dropoff.name,
    dropoff_lat: card.dropoff.lat,
    dropoff_lng: card.dropoff.lng,
    fare_basis: card.fare.basis,
    fare_low_minor: card.fare.low_minor,
    fare_high_minor: card.fare.high_minor,
    currency: (card.fare.currency as TransportCardInput["currency"]) ?? null,
    duration_min: card.duration.min,
    duration_max: card.duration.max,
    frequency_minutes: card.frequency_minutes,
    first_departure: card.first_departure,
    last_departure: card.last_departure,
    runs_sunday: card.runs_sunday,
    tips: card.tips,
    step_free: card.step_free,
    night_service: card.night_service,
    luggage_ok: card.luggage_ok,
    safety_note: card.safety_note,
    evidence: card.evidence,
  };
}
