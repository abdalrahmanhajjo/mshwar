import { describe, expect, it } from "vitest";
import { launchSteps } from "@/lib/guide-launch";
import type { GuideTour } from "@/lib/guide-work";
import type { MyGuideProfile } from "@/lib/guides";

const profile = (overrides: Partial<MyGuideProfile & { day_rate_minor: number | null }> = {}) =>
  ({
    tier: "licensed",
    headline: "",
    bio: "",
    languages: [],
    regions: [],
    day_rate_minor: null,
    ...overrides,
  }) as MyGuideProfile & { day_rate_minor: number | null };

const tour = (overrides: Partial<GuideTour>) => ({ status: "draft", upcoming_slots: 0, ...overrides }) as GuideTour;

describe("a new guide's launch checklist", () => {
  it("starts with nothing ticked", () => {
    const steps = launchSteps(profile(), [], null);
    expect(steps.map((step) => step.key)).toEqual([
      "launchProfile",
      "launchTour",
      "launchPublish",
      "launchTimes",
      "launchDates",
      "launchHire",
    ]);
    expect(steps.every((step) => !step.done)).toBe(true);
  });

  it("ticks each step only from the guide's real data", () => {
    const steps = launchSteps(
      profile({
        headline: "Byblos walks",
        bio: "Born in Jbeil",
        languages: ["ar"],
        regions: ["mount-lebanon"],
        day_rate_minor: 12000,
      }),
      [tour({ status: "published", upcoming_slots: 4 })],
      { pattern: [{ weekday: 5, start: "10:00" }], min_notice_hours: 24, max_tours_per_day: 2, exceptions: [] },
    );
    expect(steps.every((step) => step.done)).toBe(true);
  });

  it("a draft tour is created but not published or open", () => {
    const steps = Object.fromEntries(launchSteps(profile(), [tour({})], null).map((step) => [step.key, step.done]));
    expect(steps).toMatchObject({ launchTour: true, launchPublish: false, launchDates: false });
  });

  it("a schedule on a tour says when the guide works, without a weekly rhythm", () => {
    const empty = { pattern: [], min_notice_hours: 24, max_tours_per_day: 2, exceptions: [] };
    const byCount = launchSteps(profile(), [tour({})], { ...empty, schedules: 2 });
    expect(byCount.find((step) => step.key === "launchTimes")?.done).toBe(true);
    const byTour = launchSteps(profile(), [tour({ schedules: [{ id: "s1" } as never] })], empty);
    expect(byTour.find((step) => step.key === "launchTimes")?.done).toBe(true);
  });

  it("a local host is never asked for a day rate", () => {
    expect(launchSteps(profile({ tier: "host" }), [], null).some((step) => step.key === "launchHire")).toBe(false);
  });
});
