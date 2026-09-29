import { describe, expect, it } from "vitest";
import { monthCells, monthOf, quoteTotal, shiftMonth } from "@/lib/tour-booking";

describe("booking a tour", () => {
  const addons = [
    { id: "a1", name: "Pickup", price_minor: 1000, unit: "booking" as const },
    { id: "a2", name: "Tasting", price_minor: 500, unit: "person" as const },
  ];

  it("totals adults, children and extras the way the database does", () => {
    expect(
      quoteTotal({ priceMinor: 2500, priceUnit: "person", childPriceMinor: 1500, adults: 2, children: 1, addons }),
    ).toEqual({ peopleMinor: 6500, addonsMinor: 2500, totalMinor: 9000 });
  });

  it("charges children the adult price when no child price is published", () => {
    expect(
      quoteTotal({ priceMinor: 2500, priceUnit: "person", childPriceMinor: null, adults: 1, children: 2, addons: [] })
        .totalMinor,
    ).toBe(7500);
  });

  it("charges a group price once for the whole party", () => {
    expect(
      quoteTotal({ priceMinor: 12000, priceUnit: "group", childPriceMinor: 0, adults: 4, children: 2, addons: [] })
        .totalMinor,
    ).toBe(12000);
  });

  it("lays out a month from Monday", () => {
    const cells = monthCells("2027-02");
    expect(cells.slice(0, 1)).toEqual(["2027-02-01"]); // 1 February 2027 is a Monday
    expect(cells.filter(Boolean)).toHaveLength(28);
    expect(monthCells("2026-10").slice(0, 4)).toEqual([null, null, null, "2026-10-01"]); // a Thursday
  });

  it("moves between months and reads them in Beirut", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(monthOf(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11"); // already 1 November in Beirut
  });
});
