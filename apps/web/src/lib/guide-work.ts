import { apiRequest } from "@/lib/api/client";
import type { PortalBooking, PortalExperience } from "@/lib/portal";
import type { GuideTier } from "@/lib/guides";

/** One stop on a tour's route: a published catalogue place. */
export type TourStop = {
  position: number;
  experience_id: string;
  slug: string;
  title: string;
  destination_slug: string | null;
  lat: number | null;
  lng: number | null;
};

/** A tour as its guide sees it: the listing plus what only a tour has. */
export type GuideTour = PortalExperience & {
  tier: GuideTier;
  languages: string[];
  meeting_point: string;
  included: string;
  bring: string;
  cancellation_terms: string;
  route: TourStop[];
  upcoming_slots: number;
};

export type TourInput = {
  id?: string;
  title: string;
  description: string;
  duration_minutes: number;
  min_party?: number;
  max_party: number;
  min_age?: number | null;
  intensity?: number | null;
  setting?: "indoor" | "outdoor" | "mixed";
  category?: string;
  price_minor: number;
  price_unit?: "person" | "group";
  languages: string[];
  included?: string;
  bring?: string;
  cancellation_terms?: string;
  meeting: { name: string; address?: string; lat: number; lng: number; destination_slug?: string };
  route: string[];
};

export type WeeklyStart = { weekday: number; start: string };

export type GuideAvailability = {
  pattern: WeeklyStart[];
  min_notice_hours: number;
  max_tours_per_day: number;
  exceptions: { local_date: string; reason: string }[];
};

export type SlotRun = { created: number; skipped_for_daily_cap: number };

/** A tour on the guide's public page. */
export type PublicTour = {
  slug: string;
  title: string;
  description: string;
  duration_minutes: number;
  max_party: number;
  min_age: number | null;
  intensity: number | null;
  languages: string[];
  meeting_point: string;
  included: string;
  bring: string;
  cancellation_terms: string;
  price_minor: number | null;
  price_unit: "person" | "group" | null;
  route: TourStop[];
  next_slots: { id: string; starts_at: string; remaining: number }[];
};

export type TourRequest = {
  id: string;
  status: string;
  payment_required: boolean;
  total_minor: number;
  currency: string;
};

export type GuideRequest = PortalBooking;

const send = (method: string, body?: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchMyTours() {
  return apiRequest<GuideTour[]>("/api/v1/guides/me/tours");
}

export function saveTour(input: TourInput) {
  return apiRequest<GuideTour>("/api/v1/guides/me/tours", send("PUT", input));
}

export function publishTour(tourId: string) {
  return apiRequest<GuideTour>(`/api/v1/guides/me/tours/${tourId}/publish`, send("POST"));
}

export function openTourDates(tourId: string, days = 28) {
  return apiRequest<SlotRun>(`/api/v1/guides/me/tours/${tourId}/slots?days=${days}`, send("POST"));
}

export function fetchAvailability() {
  return apiRequest<GuideAvailability>("/api/v1/guides/me/availability");
}

export function saveAvailability(input: GuideAvailability) {
  return apiRequest<GuideAvailability>("/api/v1/guides/me/availability", send("PUT", input));
}

export function fetchGuideRequests(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<GuideRequest[]>(`/api/v1/guides/me/requests${query}`);
}

export function respondGuideRequest(
  bookingId: string,
  input: { status: "confirmed" | "rejected"; reason: string; message?: string },
) {
  return apiRequest<GuideRequest>(`/api/v1/guides/me/requests/${bookingId}/respond`, send("POST", input));
}

export function fetchPublicTours(guideSlug: string) {
  return apiRequest<PublicTour[]>(`/api/v1/guides/${encodeURIComponent(guideSlug)}/tours`);
}

export function requestTour(tourSlug: string, slotId: string, partySize: number, key: string) {
  return apiRequest<TourRequest>(
    `/api/v1/guides/tours/${encodeURIComponent(tourSlug)}/request`,
    send("POST", { slot_id: slotId, party_size: partySize }, { "Idempotency-Key": key }),
  );
}

/** Split a comma list the way every guide form does. */
export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Which of today's weekdays (Monday = 0) a date string falls on, as the API counts them. */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}
