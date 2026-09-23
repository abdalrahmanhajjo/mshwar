import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DaySheet } from "./day-sheet";
import { PublicGuideReviewsSection, ReviewForm } from "./guide-reviews";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { rememberDaySheet, type DaySheet as Sheet } from "@/lib/guide-day";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

const SHEET: Sheet = {
  id: "slot-1",
  kind: "tour",
  title: "Hamra on foot",
  local_date: "2099-05-02",
  starts_at: "2099-05-02T07:00:00Z",
  ends_at: "2099-05-02T09:00:00Z",
  meeting: { name: "By the fountain", address: "Hamra St", lat: 33.89, lng: 35.5 },
  stops: [{ position: 1, slug: "old-cinema", title: "Old cinema", lat: null, lng: null }],
  legs: [],
  bring: "Water",
  roster: [
    {
      booking_id: "b1",
      traveller_id: "u1",
      name: "Maya",
      party_size: 2,
      status: "confirmed",
      note: "One of us uses a cane",
      notes: {},
      phone: "+961 70 111 222",
      collect_minor: 5000,
      currency: "USD",
      reputation: { reviews: 0, average: null },
    },
    {
      booking_id: "b2",
      traveller_id: "u2",
      name: "Omar",
      party_size: 1,
      status: "pending",
      note: "",
      notes: {},
      phone: null,
      collect_minor: 2500,
      currency: "USD",
      reputation: { reviews: 3, average: 4.7 },
    },
  ],
  people: 2,
  run: { id: "r1", state: "scheduled", started_at: null, completed_at: null },
  generated_at: "2099-05-01T18:00:00Z",
};

describe("running the day", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("lists the group with phones only for confirmed travellers, and what to collect", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(SHEET)),
    );
    render(wrap(<DaySheet dayId="slot-1" />));
    expect(await screen.findByRole("heading", { name: "Hamra on foot" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /\+961 70 111 222/ })).toHaveAttribute("href", "tel:+96170111222");
    expect(screen.getByText("Not confirmed yet")).toBeInTheDocument();
    expect(screen.getByText("Collect $50.00")).toBeInTheDocument();
    expect(screen.getByText("One of us uses a cane")).toBeInTheDocument();
    expect(screen.getByText(/4.7★ from 3 guides/)).toBeInTheDocument();
    expect(screen.getByText("By the fountain")).toBeInTheDocument();
  });

  it("opens the saved copy when there is no connection", async () => {
    rememberDaySheet(SHEET);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(wrap(<DaySheet dayId="slot-1" />));
    expect(await screen.findByText(/No connection\. Showing the copy saved on this device/)).toBeInTheDocument();
    expect(screen.getByText("Maya · 2 people")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start the day/ })).not.toBeInTheDocument();
  });

  it("starts the day", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return jsonResponse(
          url.endsWith("/start") ? { ...SHEET, run: { ...SHEET.run, state: "started", started_at: "now" } } : SHEET,
        );
      }),
    );
    render(wrap(<DaySheet dayId="slot-1" />));
    fireEvent.click(await screen.findByRole("button", { name: /Start the day/ }));
    expect(await screen.findByText("Under way")).toBeInTheDocument();
    expect(calls).toContain("/api/v1/guides/me/days/slot-1/start");
  });

  it("sends one half of a review and says it stays private", async () => {
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: String(init?.body) });
        return jsonResponse({ id: "rv1", direction: "guide_to_traveller", released: false });
      }),
    );
    render(wrap(<ReviewForm runId="r1" travellerId="u1" heading="Maya · Hamra on foot" onSent={() => undefined} />));
    fireEvent.click(screen.getAllByRole("radio")[4] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: /Send review/ }));
    expect(await screen.findByText(/stays private until the other side/)).toBeInTheDocument();
    await waitFor(() =>
      expect(JSON.parse(calls[0]?.body ?? "{}")).toMatchObject({ run_id: "r1", traveller_id: "u1", rating: 5 }),
    );
  });

  it("shows the released average on a guide's page", () => {
    render(
      wrap(
        <PublicGuideReviewsSection
          reviews={{
            count: 2,
            average: 4.5,
            recent: [{ rating: 5, body: "Knew every alley", created_at: "2026-09-01", author: "Maya" }],
          }}
        />,
      ),
    );
    expect(screen.getByText("4.5★ from 2 reviews")).toBeInTheDocument();
    expect(screen.getByText("Knew every alley")).toBeInTheDocument();
  });
});
