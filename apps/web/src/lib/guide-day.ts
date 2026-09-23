import { apiRequest } from "@/lib/api/client";

export type RunState = "scheduled" | "started" | "completed";

export type DayStop = {
  position: number;
  slug: string;
  title: string;
  starts_at?: string;
  ends_at?: string;
  lat: number | null;
  lng: number | null;
  locked?: boolean;
};

export type RosterEntry = {
  booking_id?: string;
  engagement_id?: string;
  traveller_id: string;
  name: string;
  party_size: number;
  status: string;
  note: string;
  notes: { dietary?: string; accessibility?: string; children?: string };
  phone: string | null;
  collect_minor: number;
  currency: string;
  reputation: { reviews: number; average: number | null };
};

export type DaySheet = {
  id: string;
  kind: "tour" | "hire";
  title: string;
  local_date: string;
  starts_at: string;
  ends_at: string;
  meeting: { name: string; address: string; lat: number | null; lng: number | null };
  stops: DayStop[];
  legs: { position: number; distance_m: number | null; duration_seconds: number | null; status: string }[];
  bring: string;
  roster: RosterEntry[];
  people: number;
  run: { id: string; state: RunState; started_at: string | null; completed_at: string | null };
  generated_at: string;
};

export type GuideDay = {
  id: string;
  kind: "tour" | "hire";
  title: string;
  starts_at: string;
  people: number;
  state: RunState;
};

export type ReviewInbox = {
  to_review_as_guide: {
    run_id: string;
    title: string;
    completed_at: string;
    traveller_id: string;
    traveller_name: string;
  }[];
  to_review_as_traveller: {
    run_id: string;
    title: string;
    completed_at: string;
    guide_slug: string;
    guide_name: string;
  }[];
  about_me_as_guide: { id: string; rating: number; body: string; created_at: string; title: string }[];
  about_me_as_traveller: { id: string; rating: number; body: string; created_at: string; title: string }[];
  waiting_to_release: number;
};

export type PublicGuideReviews = {
  count: number;
  average: number | null;
  recent: { rating: number; body: string; created_at: string; author: string }[];
};

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchDays(days = 14) {
  return apiRequest<GuideDay[]>(`/api/v1/guides/me/days?days=${days}`);
}

export function fetchDaySheet(dayId: string) {
  return apiRequest<DaySheet>(`/api/v1/guides/me/days/${dayId}`);
}

export function startDay(dayId: string) {
  return apiRequest<DaySheet>(`/api/v1/guides/me/days/${dayId}/start`, post());
}

export function completeDay(dayId: string) {
  return apiRequest<DaySheet>(`/api/v1/guides/me/days/${dayId}/complete`, post());
}

export function fetchReviewInbox() {
  return apiRequest<ReviewInbox>("/api/v1/guides/reviews/inbox");
}

export function writeGuideReview(input: { run_id: string; traveller_id?: string; rating: number; body: string }) {
  return apiRequest<{ id: string; direction: string; released: boolean }>("/api/v1/guides/reviews", post(input));
}

export function fetchPublicGuideReviews(slug: string) {
  return apiRequest<PublicGuideReviews>(`/api/v1/guides/${encodeURIComponent(slug)}/reviews`);
}

const CACHE_PREFIX = "mshwar.day-sheet.";

/** Keep the last day sheet on this device, so it still opens with no signal. */
export function rememberDaySheet(sheet: DaySheet): void {
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${sheet.id}`, JSON.stringify(sheet));
  } catch {
    // Private mode or a full disk: the sheet still works online.
  }
}

export function recallDaySheet(dayId: string): DaySheet | null {
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${dayId}`);
    return raw ? (JSON.parse(raw) as DaySheet) : null;
  } catch {
    return null;
  }
}
