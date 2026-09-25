import { apiRequest } from "@/lib/api/client";
import type { PlaceType } from "@/lib/venues";

/**
 * Staff tools that grow the planner's catalogue and language: unmet demand, what it could not read,
 * approved phrases, open-data leads, sourced prices and place-type coverage.
 * Mirrors services/api admin_trust.py (migrations 045-049).
 */

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/** A kind of step travellers asked for that no trusted place could fill. Counts only - no words, no people. */
export type StepGap = {
  destination_slug: string;
  role: string;
  tag: string;
  meal: string;
  reason: string;
  count: number;
};

export type PlannerConcept = { slug: string; kind: string; role: string | null; example: string };

export type MissStatus = "open" | "resolved" | "dismissed";

/** Words the planner could not read: redacted, from travellers who consented, never tied to them. */
export type IntentMiss = {
  id: string;
  fragment: string;
  locale: string;
  count: number;
  first_seen: string;
  last_seen: string;
  status: MissStatus;
};

export type PhraseLocale = "en" | "ar" | "ar-LB" | "arabizi" | "fr" | "mixed";

export type IntentPhrase = {
  id: string;
  phrase: string;
  concept: string;
  locale: PhraseLocale;
  status: "approved" | "retired";
  source: string;
  created_at: string;
  retired_at: string | null;
};

export type LeadStatus = "new" | "checking" | "published" | "rejected" | "duplicate";

export type PlaceLead = {
  id: string;
  source: string;
  external_id: string;
  name: string;
  name_ar: string;
  name_fr: string;
  lat: number;
  lng: number;
  place_type: string | null;
  destination_slug: string | null;
  status: LeadStatus;
  reason: string;
  duplicate_of: string | null;
  experience_id: string | null;
  created_at: string;
  /** How often travellers asked for this kind of place here and got nothing (90 days). */
  demand?: number;
};

export type LeadFactsInput = Partial<
  Record<"halal" | "wheelchair_access" | "parking" | "kids_friendly" | "accepts_card", boolean>
>;

export type LeadPublishInput = {
  description: string;
  /** What staff confirmed on the visit or call; unknowns left out. */
  facts?: LeadFactsInput;
  /** The name on the sign and the point taken there: nothing else is copied from the lead. */
  on_site?: { name: string; name_ar?: string; lat: number; lng: number };
  notes: string;
  destination?: string;
  place_type?: string;
  setting?: "indoor" | "outdoor" | "mixed";
  duration_minutes?: number;
  address?: string;
};

export type SourcedPrice = {
  price_rule_id: string;
  experience_id: string;
  slug: string;
  title: string;
  price_type: "fixed" | "from" | "range";
  amount_minor: number;
  max_amount_minor: number | null;
  currency: string;
  unit: "person" | "group";
  source_url: string;
  source_name: string;
  checked_on: string;
  review_by: string;
  note: string;
};

export type SourcedPriceInput = {
  price_type: "fixed" | "from" | "range";
  amount_minor: number;
  max_amount_minor?: number;
  currency?: string;
  unit?: "person" | "group";
  source_url: string;
  source_name: string;
  checked_on: string;
  review_by?: string;
  note?: string;
};

export type PlaceTypeCoverage = {
  place_types: PlaceType[];
  destinations: { slug: string; name: string; untyped: number; types: Record<string, number> }[];
};

export const fetchStepGaps = (days = 30) => apiRequest<StepGap[]>(`/api/v1/admin/planner/gaps?days=${days}`);

export const fetchPlannerConcepts = () => apiRequest<PlannerConcept[]>("/api/v1/admin/planner/concepts");

export const fetchIntentMisses = (status: MissStatus = "open") =>
  apiRequest<IntentMiss[]>(`/api/v1/admin/planner/misses?status=${status}`);

export const reviewIntentMiss = (
  id: string,
  body: { decision: "phrase"; phrase: string; concept: string; locale: PhraseLocale } | { decision: "dismiss" },
) => apiRequest<IntentMiss>(`/api/v1/admin/planner/misses/${id}`, json("POST", body));

export const fetchIntentPhrases = () => apiRequest<IntentPhrase[]>("/api/v1/admin/planner/phrases");

export const addIntentPhrase = (body: { phrase: string; concept: string; locale: PhraseLocale }) =>
  apiRequest<IntentPhrase>("/api/v1/admin/planner/phrases", json("POST", body));

export const retireIntentPhrase = (id: string) =>
  apiRequest<IntentPhrase>(`/api/v1/admin/planner/phrases/${id}/retire`, json("POST"));

export function fetchLeads(filter: { status?: LeadStatus; destination?: string; placeType?: string } = {}) {
  const query = new URLSearchParams();
  query.set("status", filter.status ?? "new");
  if (filter.destination) query.set("destination", filter.destination);
  if (filter.placeType) query.set("place_type", filter.placeType);
  return apiRequest<PlaceLead[]>(`/api/v1/admin/leads?${query.toString()}`);
}

export const decideLead = (id: string, decision: "checking" | "rejected" | "duplicate", reason = "") =>
  apiRequest<PlaceLead>(`/api/v1/admin/leads/${id}/decision`, json("POST", { decision, reason }));

export const publishLead = (id: string, body: LeadPublishInput) =>
  apiRequest<PlaceLead & { slug: string; listing_kind: string }>(
    `/api/v1/admin/leads/${id}/publish`,
    json("POST", body),
  );

export const fetchPricesDue = (days = 30) => apiRequest<SourcedPrice[]>(`/api/v1/admin/prices/due?days=${days}`);

export const recordSourcedPrice = (experienceId: string, body: SourcedPriceInput) =>
  apiRequest<SourcedPrice>(`/api/v1/admin/prices/listings/${experienceId}`, json("PUT", body));

export const fetchPlaceTypeCoverage = () => apiRequest<PlaceTypeCoverage>("/api/v1/admin/place-types/coverage");

// ---- Candidate phrases and releases (migration 050) ----

export type PhraseBatch = {
  batch: string;
  candidate: number;
  approved: number;
  rejected: number;
  locales: Record<string, boolean>;
  first_added: string;
};

export type PhraseCandidate = {
  id: string;
  phrase: string;
  concept: string;
  locale: PhraseLocale;
  source: string;
  batch: string;
  variant_of: string;
  /** How it was generated, and "also reads as …" when it clashes with another concept. */
  note: string;
  status: "candidate" | "approved" | "rejected";
};

export type EvalMetrics = {
  cases: number;
  case_accuracy: number;
  step_accuracy: number;
  order_accuracy: number;
  passes: boolean;
  failures: string[];
};

export type IntentRelease = {
  id: string;
  name: string;
  version: number;
  approved_phrases: number;
  checksum: string;
  metrics: Record<string, EvalMetrics>;
  note: string;
  released_at: string;
};

export type ReleaseState = { current_checksum: string; approved_phrases: number; releases: IntentRelease[] };

export const fetchPhraseBatches = () => apiRequest<PhraseBatch[]>("/api/v1/admin/planner/candidates/batches");

export function fetchPhraseCandidates(filter: {
  batch?: string;
  concept?: string;
  locale?: string;
  status?: PhraseCandidate["status"];
  limit?: number;
  offset?: number;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filter))
    if (value !== undefined && value !== "") query.set(key, String(value));
  return apiRequest<{ total: number; items: PhraseCandidate[] }>(
    `/api/v1/admin/planner/candidates?${query.toString()}`,
  );
}

export const reviewPhraseCandidates = (ids: string[], decision: "approve" | "reject") =>
  apiRequest<{ approved: number; rejected: number; duplicates: number }>(
    "/api/v1/admin/planner/candidates/review",
    json("POST", { ids, decision }),
  );

export const fetchReleases = () => apiRequest<ReleaseState>("/api/v1/admin/planner/releases");

export const releaseIntentData = (note: string) =>
  apiRequest<IntentRelease>("/api/v1/admin/planner/releases", json("POST", { note }));

/** A listing the planner offers with no published price today (migration 051). */
export type PriceWorkItem = {
  experience_id: string;
  slug: string;
  title: string;
  listing_kind: string;
  destination_slug: string;
  place_types: string[];
  current_price_type: string | null;
  /** How often the planner put it in a trip, priced on request, in the last 90 days. */
  planned: number;
  last_source: { source_name: string; source_url: string; checked_on: string; review_by: string } | null;
};

export function fetchPriceWorklist(filter: { destination?: string; kind?: string } = {}) {
  const query = new URLSearchParams();
  if (filter.destination) query.set("destination", filter.destination);
  if (filter.kind) query.set("kind", filter.kind);
  return apiRequest<PriceWorkItem[]>(`/api/v1/admin/prices/worklist?${query.toString()}`);
}

/** The CSV staff take on visits: the leads of one status and destination, most asked-for first. */
export function fieldSheetUrl(status: "new" | "checking", destination = "") {
  const query = new URLSearchParams({ status });
  if (destination) query.set("destination", destination);
  return `/api/v1/admin/leads/field-sheet?${query.toString()}`;
}
