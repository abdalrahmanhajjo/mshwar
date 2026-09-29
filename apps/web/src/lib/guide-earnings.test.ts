import { describe, expect, it } from "vitest";
import { PLANNED_FEE_PERCENT, estimateEarnings } from "@/lib/guide-earnings";

describe("the guide earnings calculator", () => {
  it("adds tours and hired days, and a month is 52/12 weeks", () => {
    const result = estimateEarnings({
      tourPrice: 25,
      guestsPerTour: 6,
      toursPerWeek: 2,
      dayRate: 120,
      hiredDaysPerWeek: 1,
    });
    expect(result.weekly).toBe(420);
    expect(result.monthly).toBe(1820);
    expect(result.monthlyAfterPlannedFee).toBe(1601.6);
    expect(PLANNED_FEE_PERCENT).toBe(12);
  });

  it("treats empty, negative or absurd input as nothing rather than inventing money", () => {
    expect(
      estimateEarnings({
        tourPrice: Number.NaN,
        guestsPerTour: -3,
        toursPerWeek: 2,
        dayRate: -50,
        hiredDaysPerWeek: 99,
      }).weekly,
    ).toBe(0);
    expect(
      estimateEarnings({ tourPrice: 1e9, guestsPerTour: 1, toursPerWeek: 1, dayRate: 0, hiredDaysPerWeek: 0 }).weekly,
    ).toBe(10_000);
  });
});
