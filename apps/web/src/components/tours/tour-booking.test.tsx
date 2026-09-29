/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TourBookingFlow } from "./tour-booking-flow";
import { TourBookingView } from "./tour-booking-view";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { monthOf, type PublicTourPage, type TourBooking } from "@/lib/tour-booking";

vi.mock("@/components/shell/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1", display_name: "Maya" }, ready: true, auth: { status: "signed-in" } }),
}));

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

function route(handlers: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const method = init?.method ?? "GET";
      const key = Object.keys(handlers).find((pattern) => {
        const [verb, path] = pattern.includes(" ") ? pattern.split(" ") : ["", pattern];
        return (!verb || verb === method) && url.includes(path);
      });
      return key ? jsonResponse(handlers[key]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

const month = monthOf(new Date());
const DAY = `${month}-28`;
const START = { id: "slot-1", starts_at: `${DAY}T07:00:00Z`, remaining: 6, private: false, min_group: 1 };

const TOUR: PublicTourPage = {
  slug: "byblos-old-souk-walk",
  title: "Byblos old souk walk",
  description: "Two hours through the souk.",
  duration_minutes: 120,
  min_party: 1,
  max_party: 8,
  min_age: null,
  intensity: null,
  languages: ["en", "ar"],
  meeting_point: "By the castle gate",
  included: "",
  bring: "",
  cancellation_terms: "",
  price_minor: 2500,
  price_unit: "person",
  booking: {
    instant_booking: true,
    request_ttl_hours: 24,
    policy: "moderate",
    free_cancel_hours: 72,
    child_price_minor: 1500,
    child_age_max: 11,
    addons: [
      { id: "a1", name: "Pickup", price_minor: 1000, unit: "booking" },
      { id: "a2", name: "Sweets tasting", price_minor: 500, unit: "person" },
    ],
  },
  route: [],
  guide: { slug: "rami", display_name: "Rami Haddad", tier: "licensed", badge: true, founding_number: 3 },
};

const BOOKING: TourBooking = {
  id: "b1",
  code: "MSH-7K3Q9P",
  status: "confirmed",
  mode: "instant",
  reason: null,
  tour_slug: TOUR.slug,
  tour_title: TOUR.title,
  guide_slug: "rami",
  guide_name: "Rami Haddad",
  starts_at: "2099-07-01T07:00:00Z",
  ends_at: "2099-07-01T09:00:00Z",
  private: false,
  party_size: 3,
  adults: 2,
  children: 1,
  language: "en",
  adult_price_minor: 2500,
  child_price_minor: 1500,
  price_unit: "person",
  addons: [],
  addons_minor: 0,
  total_minor: 6500,
  currency: "USD",
  paid_on_the_day: true,
  note: "Vegetarian",
  policy: "moderate",
  free_cancel_until: "2099-06-28T07:00:00Z",
  response_due_at: null,
  cancelled_by: null,
  late_cancellation: false,
  rescheduled_from: null,
  rescheduled_to: null,
  meeting_point: "By the castle gate",
  reschedule: null,
  created_at: "2099-06-01T07:00:00Z",
};

describe("booking a tour", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("builds the total from the published prices and books", async () => {
    const calls = route({
      "/availability": {
        month,
        price_minor: 2500,
        price_unit: "person",
        days: [{ date: DAY, from_minor: 2500, starts: [START] }],
      },
      "POST /book": { ...BOOKING, code: "MSH-ABCDEF" },
    });
    const { container } = render(wrap(<TourBookingFlow tour={TOUR} />));
    const day = await screen.findByRole("button", { name: /from \$25/ });
    fireEvent.click(day);
    fireEvent.change(screen.getByLabelText("Adults"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Children"), { target: { value: "1" } });
    fireEvent.click(screen.getByLabelText(/^Pickup/));
    fireEvent.click(screen.getByLabelText(/^Sweets tasting/));
    // 2 x 25 + 15 + 10 + 3 x 5
    expect(screen.getByTestId("booking-total").textContent).toBe("$90");
    expect(screen.getByText("Free cancellation until 3 days before")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole("button", { name: "Book now" }));
    expect((await screen.findByTestId("booking-code")).textContent).toBe("MSH-ABCDEF");
    const post = calls.find((call) => call.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      slot_id: "slot-1",
      adults: 2,
      children: 1,
      language: null,
      addons: ["a1", "a2"],
      note: "",
    });
    expect(new Headers(post?.init?.headers).get("Idempotency-Key")).toMatch(/^book-/);
  });

  it("lets a guide accept a request and shows the traveller's note", async () => {
    const calls = route({
      "GET /api/v1/guides/me/bookings/b1": { ...BOOKING, status: "pending", response_due_at: "2099-06-02T07:00:00Z" },
      "POST /respond": { id: "b1", status: "confirmed" },
    });
    render(wrap(<TourBookingView bookingId="b1" role="guide" />));
    expect(await screen.findByText("Vegetarian")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept request" }));
    await waitFor(() => expect(calls.some((call) => call.url.includes("/respond"))).toBe(true));
    const respond = calls.find((call) => call.url.includes("/respond"));
    expect(JSON.parse(String(respond?.init?.body))).toMatchObject({ status: "confirmed" });
  });

  it("warns a traveller before a late cancellation", async () => {
    const calls = route({
      "GET /api/v1/guides/bookings/b1": { ...BOOKING, free_cancel_until: "2000-01-01T00:00:00Z" },
      "POST /cancel": { ...BOOKING, status: "cancelled", cancelled_by: "traveller", late_cancellation: true },
    });
    const { container } = render(wrap(<TourBookingView bookingId="b1" role="traveller" />));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel booking" }));
    expect(screen.getByText(/recorded as a late cancellation/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Why are you cancelling?"), { target: { value: "Flight moved" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel this booking" }));
    expect(await screen.findByText(/Cancelled after the free deadline/)).toBeTruthy();
    expect(JSON.parse(String(calls.find((call) => call.init?.method === "POST")?.init?.body))).toEqual({
      reason: "Flight moved",
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
