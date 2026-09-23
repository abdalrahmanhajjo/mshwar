import { apiRequest } from "@/lib/api/client";
import type { MyGuideProfile, PublicGuide } from "@/lib/guides";

export type EngagementState =
  "requested" | "accepted" | "declined" | "changes_proposed" | "confirmed" | "completed" | "cancelled";

export type HireableGuide = PublicGuide & {
  day_rate_minor: number | null;
  max_group: number;
  hireable: boolean;
};

export type MatchedGuide = HireableGuide & {
  matched_regions: string[];
  matched_language: boolean;
  score: number;
};

export type ItineraryStop = {
  id: string;
  position: number;
  experience_id: string;
  slug: string;
  title: string;
  starts_at: string;
  ends_at: string;
  locked: boolean;
  destination_slug: string | null;
  lat: number | null;
  lng: number | null;
};

export type EngagementItinerary = {
  version_id: string;
  version: number;
  window_start: string;
  return_by: string;
  party_size: number;
  start_lat: number | null;
  start_lng: number | null;
  stops: ItineraryStop[];
  legs: { position: number; distance_m: number | null; duration_seconds: number | null; status: string }[];
};

export type ProposalDiff = {
  added: { slug: string; title: string; position: number; starts_at: string; ends_at: string }[];
  removed: { stop_id: string; title: string; position: number }[];
  retimed: {
    stop_id: string;
    title: string;
    from_starts_at: string;
    from_ends_at: string;
    starts_at: string;
    ends_at: string;
  }[];
  moved: { stop_id: string; title: string; from: number; to: number }[];
};

export type Proposal = {
  against_version_id: string;
  stops: {
    position: number;
    from_stop_id: string | null;
    experience_id: string;
    slug: string;
    title: string;
    starts_at: string;
    ends_at: string;
    locked: boolean;
  }[];
  diff: ProposalDiff;
  note: string;
  rate_minor: number;
  proposed_at: string;
};

export type PartyNotes = { dietary?: string; accessibility?: string; children?: string };

export type Engagement = {
  id: string;
  trip_id: string;
  trip_title: string;
  viewer_role: "guide" | "traveller";
  state: EngagementState;
  local_date: string;
  party_size: number;
  rate_minor: number;
  currency: string;
  message: string;
  party_notes: PartyNotes;
  decline_reason: string;
  created_at: string;
  responded_at: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  guide: HireableGuide;
  traveller_name: string;
  itinerary: EngagementItinerary;
  proposal: Proposal | null;
  contact: { phone: string } | null;
};

export type ProposedStop = { stop_id?: string; slug?: string; starts_at: string; ends_at: string };

const post = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function setHireTerms(input: { day_rate_minor: number | null; max_group: number }) {
  return apiRequest<MyGuideProfile & HireableGuide>("/api/v1/guides/me/hire-terms", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export function matchGuides(versionId: string, filters: { language?: string; party_size?: number } = {}) {
  const search = new URLSearchParams({ version_id: versionId });
  if (filters.language) {
    search.set("language", filters.language);
  }
  if (filters.party_size) {
    search.set("party_size", String(filters.party_size));
  }
  return apiRequest<MatchedGuide[]>(`/api/v1/guides/match?${search.toString()}`);
}

export function requestEngagement(input: {
  version_id: string;
  guide_slug: string;
  party_size?: number;
  message?: string;
  party_notes?: PartyNotes;
  contact_phone?: string;
}) {
  return apiRequest<Engagement>("/api/v1/guides/engagements", post(input));
}

export function fetchTripEngagements(tripId: string) {
  return apiRequest<Engagement[]>(`/api/v1/guides/trips/${tripId}/engagements`);
}

export function fetchEngagement(engagementId: string) {
  return apiRequest<Engagement>(`/api/v1/guides/engagements/${engagementId}`);
}

export function decideEngagement(engagementId: string, decision: "confirm" | "accept_changes" | "reject_changes") {
  return apiRequest<Engagement>(`/api/v1/guides/engagements/${engagementId}/decision`, post({ decision }));
}

export function cancelEngagement(engagementId: string, reason = "") {
  return apiRequest<Engagement>(`/api/v1/guides/engagements/${engagementId}/cancel`, post({ reason }));
}

export function fetchMyEngagements(state?: EngagementState) {
  const query = state ? `?state=${state}` : "";
  return apiRequest<Engagement[]>(`/api/v1/guides/me/engagements${query}`);
}

export function answerEngagement(engagementId: string, answer: "accept" | "decline", reason = "") {
  return apiRequest<Engagement>(`/api/v1/guides/me/engagements/${engagementId}/answer`, post({ answer, reason }));
}

export function proposeChanges(
  engagementId: string,
  input: { stops: ProposedStop[]; note?: string; rate_minor?: number | null },
) {
  return apiRequest<Engagement>(`/api/v1/guides/me/engagements/${engagementId}/proposal`, post(input));
}

/** "HH:MM" in Beirut for an ISO instant, which is how a guide reads a day. */
export function beirutTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Beirut",
  }).format(new Date(iso));
}

/** Move an ISO instant to a new Beirut wall-clock time on the same Beirut day. */
export function withBeirutTime(iso: string, hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const current = beirutTime(iso).split(":").map(Number);
  const delta = ((hours ?? 0) - (current[0] ?? 0)) * 60 + ((minutes ?? 0) - (current[1] ?? 0));
  return new Date(new Date(iso).getTime() + delta * 60_000).toISOString();
}
