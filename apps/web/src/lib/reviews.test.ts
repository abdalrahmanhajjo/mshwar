import { describe, expect, it } from "vitest";
import { honestAverageLabel, LOW_SAMPLE_THRESHOLD, type ReviewAggregate } from "./reviews";

describe("review aggregates", () => {
  it("is honest when the sample is too small", () => {
    const low: ReviewAggregate = {
      count: 1,
      average: 5,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 1 },
      low_sample: true,
      honest: "Too few reviews to show a reliable average.",
    };
    expect(LOW_SAMPLE_THRESHOLD).toBe(3);
    expect(honestAverageLabel(low)).toContain("Too few reviews");
  });

  it("shows the average once the sample is large enough", () => {
    const ready: ReviewAggregate = {
      count: 4,
      average: 4.5,
      distribution: { "1": 0, "2": 0, "3": 0, "4": 2, "5": 2 },
      low_sample: false,
    };
    expect(honestAverageLabel(ready)).toContain("4.5");
  });
});
