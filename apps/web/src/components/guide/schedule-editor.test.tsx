/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockedTime } from "./blocked-time";
import { TourSchedules } from "./schedule-editor";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { GuideTour, TourSchedule } from "@/lib/guide-work";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

const SCHEDULE: TourSchedule = {
  id: "s1",
  experience_id: "t1",
  weekdays: [5, 6],
  start_times: ["09:00", "16:00"],
  valid_from: "2099-06-01",
  valid_to: null,
  capacity: 10,
  mode: "shared",
  min_group: 2,
  min_group_deadline_hours: 24,
  upcoming_slots: 34,
};

const TOUR = { id: "t1", title: "Byblos old souk walk", max_party: 8, schedules: [SCHEDULE] } as unknown as GuideTour;

function route(handlers: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      // Keys are "METHOD /path" or just "/path" for any method.
      const method = init?.method ?? "GET";
      const key =
        Object.keys(handlers).find(
          (pattern) => pattern === `${method} ${pattern.split(" ")[1]}` && url.includes(pattern.split(" ")[1]),
        ) ?? Object.keys(handlers).find((pattern) => !pattern.includes(" ") && url.includes(pattern));
      return key ? jsonResponse(handlers[key]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

describe("guide schedules and blocked time", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("summarises a schedule in plain words", async () => {
    route({});
    const { container } = render(wrap(<TourSchedules tour={TOUR} />));
    expect(screen.getByText(/Sat, Sun/)).toBeTruthy();
    expect(screen.getByText("Shared · 10 seats")).toBeTruthy();
    expect(screen.getByText("runs with 2+ guests")).toBeTruthy();
    expect(screen.getByText("34 starts open")).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("saves a new private schedule with tidy days and times", async () => {
    const calls = route({
      "PUT /schedules": { ...SCHEDULE, id: "s2", mode: "private", created: 60, cleared: 0 },
      "GET /schedules": [{ ...SCHEDULE, id: "s2", mode: "private" }],
    });
    render(wrap(<TourSchedules tour={{ ...TOUR, schedules: [] }} />));
    fireEvent.click(screen.getByRole("button", { name: "Add a schedule" }));
    // Every day is on by default: keep only Friday and Saturday.
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Sun"]) {
      fireEvent.click(screen.getByRole("button", { name: day }));
    }
    fireEvent.click(screen.getByLabelText("Private: one booking takes the whole start"));
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    await waitFor(() => expect(screen.getByText(/60 starts are open/)).toBeTruthy());
    const put = calls.find((call) => call.init?.method === "PUT");
    expect(put?.url).toContain("/api/v1/guides/me/tours/t1/schedules");
    expect(JSON.parse(String(put?.init?.body))).toMatchObject({
      weekdays: [4, 5],
      start_times: ["10:00"],
      mode: "private",
      min_group: 1,
    });
  });

  it("will not save a schedule without a day", async () => {
    const calls = route({});
    render(wrap(<TourSchedules tour={{ ...TOUR, schedules: [] }} />));
    fireEvent.click(screen.getByRole("button", { name: "Add a schedule" }));
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      fireEvent.click(screen.getByRole("button", { name: day }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));
    expect(await screen.findByText("Choose at least one day.")).toBeTruthy();
    expect(calls.some((call) => call.init?.method === "PUT")).toBe(false);
  });

  it("blocks time in Beirut time and lists it", async () => {
    const calls = route({
      "/api/v1/guides/me/blocks": [
        {
          id: "b1",
          starts_at: "2099-07-01T06:00:00Z",
          ends_at: "2099-07-01T10:00:00Z",
          kind: "manual",
          note: "Dentist",
        },
      ],
    });
    const { container } = render(wrap(<BlockedTime />));
    expect(await screen.findByText("Dentist")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2099-07-02" } });
    fireEvent.click(screen.getByRole("button", { name: "Block this time" }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === "POST")).toBe(true));
    const post = calls.find((call) => call.init?.method === "POST");
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({
      starts_at: "2099-07-02T09:00:00+03:00",
      ends_at: "2099-07-02T13:00:00+03:00",
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
