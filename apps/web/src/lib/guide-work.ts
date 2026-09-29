import { apiRequest } from "@/lib/api/client";
import type { PortalBooking, PortalExperience } from "@/lib/portal";
import type { GuideTier } from "@/lib/guides";
import type { BookingTerms } from "@/lib/tour-booking";

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
  schedules?: TourSchedule[];
  booking?: BookingTerms;
};

/** One recurring rule for one tour (guide plan step 2). Monday = 0. */
export type TourSchedule = {
  id: string;
  experience_id: string;
  weekdays: number[];
  start_times: string[];
  valid_from: string;
  valid_to: string | null;
  capacity: number | null;
  mode: "shared" | "private";
  min_group: number;
  min_group_deadline_hours: number;
  upcoming_slots: number;
};

export type ScheduleInput = {
  id?: string;
  weekdays: number[];
  start_times: string[];
  valid_from?: string | null;
  valid_to?: string | null;
  capacity?: number | null;
  mode: "shared" | "private";
  min_group: number;
  min_group_deadline_hours: number;
};

export type SavedSchedule = TourSchedule & { created: number; cleared: number };

/** Time the guide cannot work. */
export type BusyBlock = { id: string; starts_at: string; ends_at: string; kind: "manual" | "external"; note: string };

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
  buffer_minutes?: number;
  cutoff_time?: string | null;
  travel_aware?: boolean;
  /** How many tour schedules the guide has (read only). */
  schedules?: number;
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
  booking?: BookingTerms;
  next_slots: { id: string; starts_at: string; remaining: number; private?: boolean; min_group?: number }[];
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
  // The count of schedules is read only; everything else is the guide's to set.
  const { schedules: _count, ...body } = input;
  void _count;
  return apiRequest<GuideAvailability>("/api/v1/guides/me/availability", send("PUT", body));
}

export function fetchSchedules(tourId: string) {
  return apiRequest<TourSchedule[]>(`/api/v1/guides/me/tours/${tourId}/schedules`);
}

export function saveSchedule(tourId: string, input: ScheduleInput) {
  return apiRequest<SavedSchedule>(`/api/v1/guides/me/tours/${tourId}/schedules`, send("PUT", input));
}

export function deleteSchedule(scheduleId: string) {
  return apiRequest<{ deleted: boolean; cleared: number; kept_booked: number }>(
    `/api/v1/guides/me/schedules/${scheduleId}`,
    send("DELETE"),
  );
}

export function fetchBlocks() {
  return apiRequest<BusyBlock[]>("/api/v1/guides/me/blocks");
}

export function addBlock(input: { starts_at: string; ends_at: string; note?: string }) {
  return apiRequest<BusyBlock>("/api/v1/guides/me/blocks", send("POST", input));
}

export function deleteBlock(blockId: string) {
  return apiRequest<{ deleted: boolean }>(`/api/v1/guides/me/blocks/${blockId}`, send("DELETE"));
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
