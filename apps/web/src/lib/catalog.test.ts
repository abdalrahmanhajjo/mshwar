import { describe, expect, it } from "vitest";
import { DESTINATIONS, EXPERIENCES, filterExperiences, getDestination, relatedExperiences } from "./catalog";

describe("Lebanon catalog seed", () => {
  it("covers the six destination cards from the marketing screens", () => {
    expect(DESTINATIONS.map((item) => item.slug)).toEqual([
      "byblos",
      "batroun",
      "bsharri",
      "qadisha-valley",
      "baalbek",
      "beirut",
    ]);
  });

  it("filters experiences from URL state without inventing results", () => {
    const coast = filterExperiences({ category: "coast" });
    expect(coast.every((item) => item.category === "coast")).toBe(true);
    expect(filterExperiences({ q: "Byblos" }).some((item) => item.slug === "slow-day-byblos")).toBe(true);
    expect(filterExperiences({ q: "not-a-real-place" })).toEqual([]);
    const priced = filterExperiences({ sort: "price" });
    expect(priced[0].priceFrom).toBeLessThanOrEqual(priced[priced.length - 1].priceFrom);
  });

  it("keeps related experiences on the same place or category", () => {
    const related = relatedExperiences("slow-day-byblos");
    expect(related.every((item) => item.slug !== "slow-day-byblos")).toBe(true);
    expect(getDestination("byblos")?.name).toBe("Byblos");
    expect(EXPERIENCES).toHaveLength(6);
  });
});
