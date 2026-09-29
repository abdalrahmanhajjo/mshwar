import { apiRequest } from "@/lib/api/client";
import type { GuideLevel } from "@/lib/guide-quality";
import type { TourStop } from "@/lib/guide-work";

/** Guide plan step 3: booking a tour. Prices are only what the guide published. */

export type CancellationPolicy = "flexible" | "moderate" | "strict";

export type TourAddon = { id: string; name: string; price_minor: number; unit: "person" | "booking" };

export type BookingTerms = {
  instant_booking: boolean;
  request_ttl_hours: number;
  policy: CancellationPolicy;
  free_cancel_hours: number;
  child_price_minor: number | null;
  child_age_max: number | null;
  addons: TourAddon[];
};

export type BookingSettingsInput = {
  instant_booking: boolean;
  request_ttl_hours: number;
  policy: CancellationPolicy;
  child_price_minor: number | null;
  child_age_max: number | null;
  addons: { id?: string; name: string; price_minor: number; unit: "person" | "booking" }[];
};

export type TourPhoto = { url: string | null; alt_text: string };

/** A tour on the marketplace, a destination page or a guide's page. */
export type TourCard = {
  slug: string;
  title: string;
  summary: string;
  duration_minutes: number;
  max_party: number;
  languages: string[];
  price_minor: number | null;
  price_unit: "person" | "group" | null;
  instant_booking: boolean;
  policy: CancellationPolicy;
  destination: { slug: string; name: string } | null;
  lat: number | null;
  lng: number | null;
  photo: TourPhoto | null;
  next_start: string | null;
  guide: {
    slug: string;
    display_name: string;
    badge: boolean;
    founding_number: number | null;
    tier: "licensed" | "host";
    level?: GuideLevel;
  };
  /** Only released reviews count. */
  rating: { count: number; average: number | null };
};

export type TourSearch = {
  tours: TourCard[];
  total: number;
  destinations: { slug: string; name: string }[];
};

export type TourFaq = { question: string; answer: string };

/** One published tour, as the tour page and the booking page read it. */
export type PublicTourPage = {
  slug: string;
  title: string;
  description: string;
  duration_minutes: number;
  min_party: number;
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
  booking: BookingTerms;
  route: TourStop[];
  guide: {
    slug: string;
    display_name: string;
    tier: "licensed" | "host";
    badge: boolean;
    founding_number: number | null;
    headline?: string;
    languages?: string[];
    level?: GuideLevel;
    tours_given?: number;
    /** Typical reply time from the nightly numbers; null until there is one. */
    response_minutes?: number | null;
  };
  summary?: string;
  photos?: TourPhoto[];
  photo?: TourPhoto | null;
  highlights?: string[];
  faq?: TourFaq[];
  accessibility?: string;
  destination?: { slug: string; name: string } | null;
  lat?: number | null;
  lng?: number | null;
  next_start?: string | null;
  rating?: { count: number; average: number | null };
  updated_at?: string;
};

export type AvailableStart = {
  id: string;
  starts_at: string;
  remaining: number;
  private: boolean;
  min_group: number;
};

export type AvailabilityMonth = {
  month: string;
  price_minor: number | null;
  price_unit: "person" | "group" | null;
  days: { date: string; from_minor: number | null; starts: AvailableStart[] }[];
};

export type BookedAddon = {
  id: string;
  name: string;
  unit: "person" | "booking";
  price_minor: number;
  quantity: number;
  total_minor: number;
};

export type TourBooking = {
  id: string;
  code: string;
  status: "pending" | "confirmed" | "rejected" | "cancelled" | "expired" | "completed" | "refunded";
  mode: "instant" | "request";
  reason: string | null;
  tour_slug: string;
  tour_title: string;
  guide_slug: string;
  guide_name: string;
  starts_at: string;
  ends_at: string;
  private: boolean;
  party_size: number;
  adults: number;
  children: number;
  language: string | null;
  adult_price_minor: number;
  child_price_minor: number;
  price_unit: "person" | "group";
  addons: BookedAddon[];
  addons_minor: number;
  total_minor: number;
  currency: string;
  paid_on_the_day: boolean;
  note: string;
  policy: CancellationPolicy;
  free_cancel_until: string;
  response_due_at: string | null;
  cancelled_by: "traveller" | "guide" | "system" | null;
  late_cancellation: boolean;
  rescheduled_from: string | null;
  rescheduled_to: string | null;
  meeting_point: string;
  reschedule: {
    id: string;
    by_role: "traveller" | "guide";
    new_slot_id: string;
    new_starts_at: string;
    message: string;
    status: string;
  } | null;
  created_at: string;
  /** On the traveller's own booking: the meeting point, and the guide's phone once confirmed. */
  meeting_lat?: number | null;
  meeting_lng?: number | null;
  guide_phone?: string | null;
  arrived_at?: string | null;
  /** The guide's record of the day (guide view only). */
  checked_in_at?: string | null;
  no_show?: boolean;
  paid_minor?: number | null;
  paid_method?: PaymentMethod | null;
  paid_at?: string | null;
};

export type PaymentMethod = "cash" | "wallet" | "card" | "transfer" | "other";

export type BookingInput = {
  slot_id: string;
  adults: number;
  children: number;
  language?: string | null;
  addons: string[];
  note: string;
};

const send = (method: string, body?: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json", ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function saveBookingSettings(tourId: string, input: BookingSettingsInput) {
  return apiRequest<BookingTerms>(`/api/v1/guides/me/tours/${tourId}/booking-settings`, send("PUT", input));
}

export function saveTourContent(
  tourId: string,
  input: { highlights: string[]; faq: TourFaq[]; accessibility: string },
) {
  return apiRequest<{ highlights: string[]; faq: TourFaq[]; accessibility: string }>(
    `/api/v1/guides/me/tours/${tourId}/content`,
    send("PUT", input),
  );
}

export function fetchTour(slug: string) {
  return apiRequest<PublicTourPage>(`/api/v1/guides/tours/${encodeURIComponent(slug)}`);
}

export function fetchAvailabilityMonth(slug: string, month: string) {
  return apiRequest<AvailabilityMonth>(
    `/api/v1/guides/tours/${encodeURIComponent(slug)}/availability?month=${encodeURIComponent(month)}`,
  );
}

export function bookTour(slug: string, input: BookingInput, key: string) {
  return apiRequest<TourBooking>(
    `/api/v1/guides/tours/${encodeURIComponent(slug)}/book`,
    send("POST", input, { "Idempotency-Key": key }),
  );
}

export function fetchMyTourBooking(bookingId: string) {
  return apiRequest<TourBooking>(`/api/v1/guides/bookings/${bookingId}`);
}

export function fetchGuideTourBooking(bookingId: string) {
  return apiRequest<TourBooking>(`/api/v1/guides/me/bookings/${bookingId}`);
}

export function cancelTourBooking(bookingId: string, reason: string) {
  return apiRequest<TourBooking>(`/api/v1/guides/bookings/${bookingId}/cancel`, send("POST", { reason }));
}

export function proposeReschedule(bookingId: string, slotId: string, message: string) {
  return apiRequest<TourBooking>(
    `/api/v1/guides/bookings/${bookingId}/reschedule`,
    send("POST", { slot_id: slotId, message }),
  );
}

export function tourBookingsList(when: "upcoming" | "past") {
  return apiRequest<TourBooking[]>(`/api/v1/guides/my-bookings?when=${when}`);
}

export function markArrived(bookingId: string) {
  return apiRequest<TourBooking>(`/api/v1/guides/bookings/${bookingId}/arrived`, send("POST", {}));
}

/** wa.me wants digits only, with the country code. */
export function whatsappUrl(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, "").replace(/^00/, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits.startsWith("961") || digits.length > 10 ? digits : `961${digits.replace(/^0/, "")}`}`;
}

export function answerReschedule(bookingId: string, accept: boolean) {
  return apiRequest<TourBooking>(`/api/v1/guides/bookings/${bookingId}/reschedule/answer`, send("POST", { accept }));
}

/**
 * The total the database will charge, for the review screen: adults at the published
 * price, children at the child price (or the adult price when none is set), and extras
 * per person or per booking. A group price is one price for the whole party.
 */
export function quoteTotal(input: {
  priceMinor: number;
  priceUnit: "person" | "group";
  childPriceMinor: number | null;
  adults: number;
  children: number;
  addons: TourAddon[];
}): { peopleMinor: number; addonsMinor: number; totalMinor: number } {
  const adults = Math.max(0, Math.floor(input.adults));
  const children = Math.max(0, Math.floor(input.children));
  const party = adults + children;
  const childPrice = input.childPriceMinor ?? input.priceMinor;
  const peopleMinor =
    input.priceUnit === "person" ? adults * input.priceMinor + children * childPrice : input.priceMinor;
  const addonsMinor = input.addons.reduce(
    (sum, addon) => sum + addon.price_minor * (addon.unit === "person" ? party : 1),
    0,
  );
  return { peopleMinor, addonsMinor, totalMinor: peopleMinor + addonsMinor };
}

/** "2027-07" for a date, in Beirut. */
export function monthOf(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}`;
}

/** The month before or after "YYYY-MM". */
export function shiftMonth(month: string, by: number): string {
  const [year, value] = month.split("-").map(Number);
  const index = year * 12 + (value - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * The cells of a month calendar starting on Monday: null for the blanks before the 1st,
 * then "YYYY-MM-DD" for each day.
 */
export function monthCells(month: string): (string | null)[] {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  const days = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
}

export function newBookingKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `book-${crypto.randomUUID()}`
    : `book-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
