import { apiRequest } from "@/lib/api/client";
import type { PaymentMethod, TourBooking } from "@/lib/tour-booking";

/** Guide plan step 6: the guide's workspace (month view, calendars, the day, money, insights). */

export type CalendarBooking = {
  id: string;
  status: "pending" | "confirmed" | "completed";
  party_size: number;
  code: string | null;
  checked_in: boolean;
  no_show: boolean | null;
};

export type CalendarSlot = {
  id: string;
  tour_id: string;
  tour_title: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  reserved: number;
  private: boolean;
  closed: boolean;
  bookings: CalendarBooking[];
};

export type CalendarBlock = {
  id: string;
  starts_at: string;
  ends_at: string;
  kind: "manual" | "external";
  note: string;
};

export type GuideMonth = {
  slots: CalendarSlot[];
  blocks: CalendarBlock[];
  hired_days: { id: string; local_date: string; state: string }[];
  days_off: { local_date: string; reason: string }[];
};

export type ExternalCalendar = {
  id: string;
  host: string;
  label: string;
  last_synced_at: string | null;
  last_status: "pending" | "ok" | "failed";
  last_error: string;
  events: number;
};

export type FeedStatus = { active: boolean; created_at: string | null; url?: string };

export type EarningsRow = {
  booking_id: string;
  code: string;
  starts_at: string;
  tour_title: string;
  party_size: number;
  status: string;
  no_show: boolean;
  expected_minor: number;
  paid_minor: number | null;
  paid_method: PaymentMethod | null;
};

export type Earnings = {
  month: string;
  currency: string;
  fee_percent: number;
  rows: EarningsRow[];
  bookings: number;
  guests: number;
  expected_minor: number;
  recorded_minor: number;
  fee_minor: number;
  net_minor: number;
  upcoming_minor: number;
  upcoming_bookings: number;
};

export type TourInsight = {
  id: string;
  title: string;
  bookings: number;
  requests: number;
  confirmed: number;
  declined: number;
  lapsed: number;
  cancelled_by_guide: number;
  cancelled_by_traveller: number;
  guests: number;
  occupancy: number | null;
};

export type Insights = {
  days: number;
  tours: TourInsight[];
  response: { answered: number; within_24h: number; median_minutes: number | null };
};

const send = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export function fetchGuideMonth(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return apiRequest<GuideMonth>(`/api/v1/guides/me/calendar?${query}`);
}

export function fetchFeedStatus() {
  return apiRequest<FeedStatus>("/api/v1/guides/me/calendar-feed");
}

export function createFeed() {
  return apiRequest<FeedStatus>("/api/v1/guides/me/calendar-feed", send("POST"));
}

export function revokeFeed() {
  return apiRequest<FeedStatus>("/api/v1/guides/me/calendar-feed", send("DELETE"));
}

export function fetchExternalCalendars() {
  return apiRequest<ExternalCalendar[]>("/api/v1/guides/me/calendars");
}

export function addExternalCalendar(url: string, label: string) {
  return apiRequest<ExternalCalendar[]>("/api/v1/guides/me/calendars", send("POST", { url, label }));
}

export function syncExternalCalendars() {
  return apiRequest<ExternalCalendar[]>("/api/v1/guides/me/calendars/sync", send("POST"));
}

export function removeExternalCalendar(id: string) {
  return apiRequest<ExternalCalendar[]>(`/api/v1/guides/me/calendars/${id}`, send("DELETE"));
}

export function checkIn(bookingId: string, status: "arrived" | "no_show") {
  return apiRequest<TourBooking>(`/api/v1/guides/me/bookings/${bookingId}/check-in`, send("POST", { status }));
}

export function recordPayment(bookingId: string, amountMinor: number, method: PaymentMethod) {
  return apiRequest<TourBooking>(
    `/api/v1/guides/me/bookings/${bookingId}/payment`,
    send("POST", { amount_minor: amountMinor, method }),
  );
}

export function fetchEarnings(month: string) {
  return apiRequest<Earnings>(`/api/v1/guides/me/earnings?month=${encodeURIComponent(month)}`);
}

export function earningsCsvUrl(month: string) {
  return `/api/v1/guides/me/earnings.csv?month=${encodeURIComponent(month)}`;
}

export function fetchInsights(days: number) {
  return apiRequest<Insights>(`/api/v1/guides/me/insights?days=${days}`);
}

// ---- Dates, all in Beirut time -------------------------------------------------------------

const BEIRUT = "Asia/Beirut";

/** YYYY-MM-DD of an instant, in Beirut. */
export function beirutDay(iso: string | number | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIRUT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return parts;
}

/** The first day of the month (YYYY-MM-01) shifted by ``delta`` months. */
export function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

/** The last day of a month given as YYYY-MM-01. */
export function monthEnd(month: string): string {
  const [year, mon] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return `${year}-${String(mon).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

export type DayState = "empty" | "open" | "partly" | "full" | "private" | "blocked" | "hired" | "off";

export type DaySummary = {
  date: string;
  state: DayState;
  slots: CalendarSlot[];
  blocks: CalendarBlock[];
  hired: GuideMonth["hired_days"];
  off: GuideMonth["days_off"];
};

/** Everything on one Beirut day, and the one word that best describes it. */
export function summariseDays(month: GuideMonth): Map<string, DaySummary> {
  const days = new Map<string, DaySummary>();
  const day = (date: string) => {
    let entry = days.get(date);
    if (!entry) {
      entry = { date, state: "empty", slots: [], blocks: [], hired: [], off: [] };
      days.set(date, entry);
    }
    return entry;
  };
  for (const slot of month.slots) day(beirutDay(slot.starts_at)).slots.push(slot);
  for (const block of month.blocks) {
    // A block can span days: list it on each day it touches.
    const last = beirutDay(new Date(new Date(block.ends_at).getTime() - 1));
    for (let date = beirutDay(block.starts_at), guard = 0; date <= last && guard < 32; guard += 1) {
      day(date).blocks.push(block);
      const [y, m, d] = date.split("-").map(Number);
      date = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    }
  }
  for (const hired of month.hired_days) day(hired.local_date).hired.push(hired);
  for (const off of month.days_off) day(off.local_date).off.push(off);
  for (const entry of days.values()) entry.state = dayState(entry);
  return days;
}

function dayState(entry: DaySummary): DayState {
  if (entry.hired.length) return "hired";
  if (entry.off.length) return "off";
  const live = entry.slots.filter((slot) => !slot.closed || slot.reserved > 0);
  if (live.some((slot) => slot.private && slot.reserved > 0)) return "private";
  const booked = live.filter((slot) => slot.reserved > 0);
  if (live.length && booked.length === live.length && live.every((slot) => slot.reserved >= slot.capacity)) {
    return "full";
  }
  if (booked.length) return "partly";
  if (live.length) return "open";
  if (entry.blocks.length) return "blocked";
  return "empty";
}
