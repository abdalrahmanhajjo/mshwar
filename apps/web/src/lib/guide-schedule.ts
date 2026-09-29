import type { ScheduleInput, TourSchedule } from "@/lib/guide-work";

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Beirut's UTC offset ("+03:00") at a wall-clock moment, summer time included. */
export function beirutOffset(date: string, time: string): string {
  const guess = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(guess.getTime())) {
    return "+02:00";
  }
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Beirut", timeZoneName: "longOffset" })
    .formatToParts(guess)
    .find((item) => item.type === "timeZoneName")?.value;
  const match = part?.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "+02:00";
}

/** A Beirut wall-clock date and time as an ISO instant the API can store. */
export function beirutInstant(date: string, time: string): string {
  return `${date}T${time}:00${beirutOffset(date, time)}`;
}

/** Start times in clock order, valid and without repeats. */
export function sortTimes(times: string[]): string[] {
  return [...new Set(times.map((time) => time.slice(0, 5)).filter((time) => CLOCK.test(time)))].sort();
}

/** What is missing before a schedule can be saved, as copy keys; empty when it is ready. */
export function scheduleProblems(input: ScheduleInput): ("scheduleNeedDay" | "scheduleNeedTime")[] {
  const problems: ("scheduleNeedDay" | "scheduleNeedTime")[] = [];
  if (!input.weekdays.length) {
    problems.push("scheduleNeedDay");
  }
  if (!sortTimes(input.start_times).length) {
    problems.push("scheduleNeedTime");
  }
  return problems;
}

/** A fresh schedule: every day at 10:00, shared, no minimum. */
export function blankSchedule(): ScheduleInput {
  return {
    weekdays: [...WEEKDAYS],
    start_times: ["10:00"],
    valid_from: null,
    valid_to: null,
    capacity: null,
    mode: "shared",
    min_group: 1,
    min_group_deadline_hours: 24,
  };
}

/** The editable shape of a saved schedule. */
export function scheduleInput(schedule: TourSchedule): ScheduleInput {
  return {
    id: schedule.id,
    weekdays: [...schedule.weekdays],
    start_times: [...schedule.start_times],
    valid_from: schedule.valid_from,
    valid_to: schedule.valid_to,
    capacity: schedule.capacity,
    mode: schedule.mode,
    min_group: schedule.min_group,
    min_group_deadline_hours: schedule.min_group_deadline_hours,
  };
}

/** The body sent to the API: a private start has no minimum group, and times are tidy. */
export function scheduleBody(input: ScheduleInput): ScheduleInput {
  return {
    ...input,
    weekdays: [...new Set(input.weekdays)].sort((a, b) => a - b),
    start_times: sortTimes(input.start_times),
    valid_from: input.valid_from || null,
    valid_to: input.valid_to || null,
    capacity: input.capacity || null,
    min_group: input.mode === "private" ? 1 : Math.max(1, input.min_group),
  };
}
