import { describe, expect, it, vi } from "vitest";
import {
  bookingsToCsv,
  can,
  filterBookings,
  LEBANON,
  metricDelta,
  metricsToCsv,
  pointInLebanon,
  readActiveOrgId,
  writeActiveOrgId,
} from "./portal";

describe("portal helpers", () => {
  it("validates Lebanon coordinates", () => {
    expect(pointInLebanon(LEBANON.beirut.lng, LEBANON.beirut.lat)).toBe(true);
    expect(pointInLebanon(2.35, 48.85)).toBe(false);
  });

  it("gates roles independently", () => {
    expect(can("inventory", "listings")).toBe(true);
    expect(can("inventory", "bookings")).toBe(false);
    expect(can("bookings", "bookings")).toBe(true);
    expect(can("finance", "settings")).toBe(false);
    expect(can("owner", "settings")).toBe(true);
    expect(can(undefined, "listings")).toBe(false);
  });

  it("filters bookings and exports csv without leaking extra columns", () => {
    const rows = [
      {
        id: "1",
        status: "pending",
        party_size: 2,
        traveller_note: "Window",
        experience_id: "e1",
        experience_title: "Tasting",
        starts_at: "2026-09-20T10:00:00Z",
        ends_at: "2026-09-20T12:00:00Z",
        capacity: 10,
        reserved: 2,
        remaining: 8,
        total_minor: 9000,
        currency: "USD",
      },
      {
        id: "2",
        status: "confirmed",
        party_size: 4,
        traveller_note: "",
        experience_id: "e2",
        experience_title: "Hike",
        starts_at: "2026-09-21T10:00:00Z",
        ends_at: "2026-09-21T12:00:00Z",
        capacity: 8,
        reserved: 4,
        remaining: 4,
        total_minor: 12000,
        currency: "USD",
      },
    ];
    expect(filterBookings(rows, { status: "pending" })).toHaveLength(1);
    expect(filterBookings(rows, { query: "hike" })[0]?.id).toBe("2");
    const csv = bookingsToCsv(filterBookings(rows, { experienceId: "e1" }));
    expect(csv).toContain("Tasting");
    expect(csv).not.toContain("Hike");
    expect(metricDelta(5, 2)).toBe(3);
    expect(
      metricsToCsv({
        from: "a",
        to: "b",
        comparison_from: "c",
        comparison_to: "d",
        current: { views: 3 },
        previous: { views: 1 },
      }),
    ).toContain("views,3,1");
  });

  it("persists the active organisation", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    writeActiveOrgId("org-1");
    expect(readActiveOrgId()).toBe("org-1");
    vi.unstubAllGlobals();
  });
});
