/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarSync } from "./calendar-sync";
import { DayRecord } from "./day-record";
import { GuideProvider } from "./guide-provider";
import { GuideEarnings, GuideInsights } from "./guide-money";
import { GuideMonthView } from "./guide-month";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { monthEnd, shiftMonth, summariseDays, type Earnings, type GuideMonth } from "@/lib/guide-workspace";
import type { TourBooking } from "@/lib/tour-booking";

vi.mock("@/components/shell/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1", display_name: "Rami" }, ready: true, auth: { status: "signed-in" } }),
}));

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

/** Longest matching "METHOD /path" (or "/path") wins, so specific routes beat their parents. */
function route(handlers: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const method = init?.method ?? "GET";
      const key = Object.keys(handlers)
        .filter((pattern) => {
          const [verb, path] = pattern.includes(" ") ? pattern.split(" ") : ["", pattern];
          return (!verb || verb === method) && url.startsWith(path);
        })
        .sort((a, b) => b.length - a.length)[0];
      return key ? jsonResponse(handlers[key]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

const PROFILE = {
  id: "g1",
  slug: "rami",
  tier: "licensed",
  badge: true,
  display_name: "Rami",
  status: "approved",
  organization_id: "org-1",
  languages: ["en"],
  regions: [],
  specialities: [],
  required_documents: [],
  documents: [],
};

const MONTH: GuideMonth = {
  slots: [
    {
      id: "s1",
      tour_id: "t1",
      tour_title: "Byblos harbour walk",
      starts_at: "2026-10-05T07:00:00Z",
      ends_at: "2026-10-05T09:00:00Z",
      capacity: 8,
      reserved: 3,
      private: false,
      closed: false,
      bookings: [
        { id: "b1", status: "confirmed", party_size: 3, code: "MSH-ABC234", checked_in: false, no_show: false },
      ],
    },
    {
      id: "s2",
      tour_id: "t1",
      tour_title: "Byblos harbour walk",
      starts_at: "2026-10-06T07:00:00Z",
      ends_at: "2026-10-06T09:00:00Z",
      capacity: 8,
      reserved: 0,
      private: false,
      closed: false,
      bookings: [],
    },
  ],
  blocks: [
    {
      id: "k1",
      starts_at: "2026-10-07T06:00:00Z",
      ends_at: "2026-10-08T12:00:00Z",
      kind: "external",
      note: "",
    },
  ],
  hired_days: [{ id: "e1", local_date: "2026-10-10", state: "confirmed" }],
  days_off: [{ local_date: "2026-10-11", reason: "Family" }],
};

describe("the guide's month", () => {
  it("summarises each Beirut day in one word", () => {
    const days = summariseDays(MONTH);
    expect(days.get("2026-10-05")?.state).toBe("partly");
    expect(days.get("2026-10-06")?.state).toBe("open");
    expect(days.get("2026-10-07")?.state).toBe("blocked");
    expect(days.get("2026-10-08")?.state).toBe("blocked");
    expect(days.get("2026-10-09")).toBeUndefined();
    expect(days.get("2026-10-10")?.state).toBe("hired");
    expect(days.get("2026-10-11")?.state).toBe("off");
    const full = summariseDays({ ...MONTH, slots: [{ ...MONTH.slots[0], reserved: 8 }] });
    expect(full.get("2026-10-05")?.state).toBe("full");
    const privateRun = summariseDays({ ...MONTH, slots: [{ ...MONTH.slots[0], private: true }] });
    expect(privateRun.get("2026-10-05")?.state).toBe("private");
  });

  it("moves between months and knows their last day", () => {
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(monthEnd("2028-02-01")).toBe("2028-02-29");
  });
});

describe("guide workspace screens", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T07:10:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the month and opens a day with its bookings", async () => {
    const calls = route({ "/api/v1/guides/me/calendar": MONTH });
    const { container } = render(wrap(<GuideMonthView />));
    const day = await screen.findByRole("button", {
      name: /October 5, 2026, Partly booked|5 October 2026, Partly booked/,
    });
    expect(calls[0].url).toContain("from=2026-10-01");
    expect(calls[0].url).toContain("to=2026-10-31");
    fireEvent.click(day);
    expect(await screen.findByText("MSH-ABC234")).toBeTruthy();
    expect(screen.getByText("3 of 8 booked")).toBeTruthy();
    expect(screen.getByRole("link", { name: /MSH-ABC234/ }).getAttribute("href")).toBe("/guide/bookings/b1");
    fireEvent.click(screen.getByRole("button", { name: /October 7, 2026, Busy|7 October 2026, Busy/ }));
    expect(await screen.findByText(/Busy in your calendar/)).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows a new feed address once and connects another calendar", async () => {
    const calls = route({
      "GET /api/v1/guides/me/calendar-feed": { active: false, created_at: null },
      "POST /api/v1/guides/me/calendar-feed": {
        active: true,
        created_at: "2026-10-05T07:10:00Z",
        url: "https://mshwar.app/api/v1/guides/feeds/secret-token-value-123456.ics",
      },
      "GET /api/v1/guides/me/calendars": [],
      "POST /api/v1/guides/me/calendars": [
        {
          id: "c1",
          host: "calendar.google.com",
          label: "Personal",
          last_synced_at: "2026-10-05T07:10:00Z",
          last_status: "ok",
          last_error: "",
          events: 4,
        },
      ],
    });
    const { container } = render(wrap(<CalendarSync />));
    fireEvent.click(await screen.findByRole("button", { name: "Create address" }));
    expect(await screen.findByDisplayValue(/feeds\/secret-token-value-123456\.ics/)).toBeTruthy();
    expect(screen.getByText(/shown only once/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Secret address"), {
      target: { value: "https://calendar.google.com/calendar/ical/x/basic.ics" },
    });
    fireEvent.change(screen.getByLabelText("Name (optional)"), { target: { value: "Personal" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Personal")).toBeTruthy();
    expect(screen.getByText(/4 busy times/)).toBeTruthy();
    const post = calls.find((call) => call.init?.method === "POST" && call.url.endsWith("/me/calendars"));
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      url: "https://calendar.google.com/calendar/ical/x/basic.ics",
      label: "Personal",
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("checks guests in and records the payment on the day", async () => {
    const booking = {
      id: "b1",
      status: "confirmed",
      starts_at: "2026-10-05T07:00:00Z",
      ends_at: "2026-10-05T09:00:00Z",
      total_minor: 4500,
      currency: "USD",
      checked_in_at: null,
      no_show: false,
      paid_minor: null,
      paid_method: null,
    } as unknown as TourBooking;
    const calls = route({
      "POST /api/v1/guides/me/bookings/b1/check-in": { ...booking, checked_in_at: "2026-10-05T07:05:00Z" },
      "POST /api/v1/guides/me/bookings/b1/payment": {
        ...booking,
        checked_in_at: "2026-10-05T07:05:00Z",
        paid_minor: 4000,
        paid_method: "wallet",
      },
    });
    let current = booking;
    const onChange = vi.fn((next: TourBooking) => {
      current = next;
    });
    const { rerender, container } = render(wrap(<DayRecord booking={current} onChange={onChange} />));
    fireEvent.click(screen.getByRole("button", { name: "Guests arrived" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    rerender(wrap(<DayRecord booking={current} onChange={onChange} />));
    expect(screen.getByText(/Checked in at/)).toBeTruthy();

    expect((screen.getByLabelText("Amount (USD)") as HTMLInputElement).value).toBe("45");
    fireEvent.change(screen.getByLabelText("Amount (USD)"), { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("How"), { target: { value: "wallet" } });
    fireEvent.click(screen.getByRole("button", { name: "Save payment" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
    const pay = calls.find((call) => call.url.endsWith("/payment"));
    expect(JSON.parse(String(pay?.init?.body))).toEqual({ amount_minor: 4000, method: "wallet" });
    rerender(wrap(<DayRecord booking={current} onChange={onChange} />));
    expect(screen.getByText(/Recorded \$40/)).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows the month's statement without inventing a fee", async () => {
    const statement: Earnings = {
      month: "2026-10",
      currency: "USD",
      fee_percent: 0,
      rows: [
        {
          booking_id: "b1",
          code: "MSH-ABC234",
          starts_at: "2026-10-05T07:00:00Z",
          tour_title: "Byblos harbour walk",
          party_size: 3,
          status: "confirmed",
          no_show: false,
          expected_minor: 7500,
          paid_minor: 7000,
          paid_method: "cash",
        },
      ],
      bookings: 1,
      guests: 3,
      expected_minor: 7500,
      recorded_minor: 7000,
      fee_minor: 0,
      net_minor: 7000,
      upcoming_minor: 0,
      upcoming_bookings: 0,
    };
    route({ "/api/v1/guides/me/earnings": statement, "/api/v1/guides/me": PROFILE });
    const { container } = render(wrap(<GuideProvider>{<GuideEarnings />}</GuideProvider>));
    expect(await screen.findByText("MSH-ABC234")).toBeTruthy();
    expect(screen.getByText("Mshwar fee (0%)")).toBeTruthy();
    expect(screen.getAllByText("$70.00").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Download CSV/ }).getAttribute("href")).toBe(
      "/api/v1/guides/me/earnings.csv?month=2026-10-01",
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows insights per tour", async () => {
    route({
      "/api/v1/guides/me/insights": {
        days: 90,
        tours: [
          {
            id: "t1",
            title: "Byblos harbour walk",
            bookings: 4,
            requests: 3,
            confirmed: 2,
            declined: 1,
            lapsed: 0,
            cancelled_by_guide: 0,
            cancelled_by_traveller: 1,
            guests: 5,
            occupancy: 40,
          },
        ],
        response: { answered: 3, within_24h: 2, median_minutes: 45 },
      },
      "/api/v1/guides/me": PROFILE,
    });
    const { container } = render(wrap(<GuideProvider>{<GuideInsights />}</GuideProvider>));
    expect(await screen.findByText("Byblos harbour walk")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText(/2 of 3 requests answered within 24 hours · typical reply 45 min/)).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });
});
