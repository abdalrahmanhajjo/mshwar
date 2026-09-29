import { describe, expect, it } from "vitest";
import {
  beirutInstant,
  beirutOffset,
  blankSchedule,
  scheduleBody,
  scheduleInput,
  scheduleProblems,
  sortTimes,
} from "@/lib/guide-schedule";

describe("guide schedules", () => {
  it("knows Beirut's winter and summer offsets", () => {
    expect(beirutOffset("2027-01-15", "10:00")).toBe("+02:00");
    expect(beirutOffset("2027-07-15", "10:00")).toBe("+03:00");
    expect(beirutInstant("2027-07-15", "09:30")).toBe("2027-07-15T09:30:00+03:00");
    expect(new Date(beirutInstant("2027-01-15", "10:00")).toISOString()).toBe("2027-01-15T08:00:00.000Z");
  });

  it("keeps start times valid, unique and in clock order", () => {
    expect(sortTimes(["15:00", "09:30", "09:30", "25:00", "07:05:00"])).toEqual(["07:05", "09:30", "15:00"]);
  });

  it("says what is missing before saving", () => {
    expect(scheduleProblems(blankSchedule())).toEqual([]);
    expect(scheduleProblems({ ...blankSchedule(), weekdays: [], start_times: ["99:00"] })).toEqual([
      "scheduleNeedDay",
      "scheduleNeedTime",
    ]);
  });

  it("sends a private schedule without a minimum group, and empty fields as null", () => {
    const body = scheduleBody({
      ...blankSchedule(),
      weekdays: [5, 1, 5],
      start_times: ["17:00", "09:00"],
      valid_from: "",
      capacity: 0,
      mode: "private",
      min_group: 4,
    });
    expect(body).toMatchObject({
      weekdays: [1, 5],
      start_times: ["09:00", "17:00"],
      valid_from: null,
      capacity: null,
      min_group: 1,
    });
  });

  it("round-trips a saved schedule into the form", () => {
    const saved = {
      id: "s1",
      experience_id: "t1",
      weekdays: [0, 2],
      start_times: ["10:00"],
      valid_from: "2027-06-01",
      valid_to: "2027-09-30",
      capacity: 10,
      mode: "shared" as const,
      min_group: 2,
      min_group_deadline_hours: 24,
      upcoming_slots: 30,
    };
    expect(scheduleInput(saved)).toEqual({
      id: "s1",
      weekdays: [0, 2],
      start_times: ["10:00"],
      valid_from: "2027-06-01",
      valid_to: "2027-09-30",
      capacity: 10,
      mode: "shared",
      min_group: 2,
      min_group_deadline_hours: 24,
    });
  });
});
