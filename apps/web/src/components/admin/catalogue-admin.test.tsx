/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CatalogueGrowthAdmin } from "./catalogue-growth";
import { PlannerLanguageAdmin } from "./planner-language";
import { LocaleProvider } from "@/components/shell/locale-provider";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

/** First matching prefix wins; POST/PUT bodies are recorded. */
function route(handlers: [string, unknown][]) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const hit = handlers.find(([prefix]) => url.startsWith(prefix));
      return hit ? jsonResponse(hit[1]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

const TYPES = [
  {
    slug: "bowling",
    group: "entertainment",
    role: "activity",
    names: { en: "Bowling", ar: "بولينغ", fr: "Bowling" },
    default_minutes: 90,
    meal_services: [],
    season_months: null,
    needs_schedule: false,
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("planner language and demand", () => {
  it("shows unmet demand, teaches a phrase from a miss, and retires a phrase", async () => {
    const calls = route([
      [
        "/api/v1/admin/planner/gaps",
        [
          {
            destination_slug: "batroun",
            role: "activity",
            tag: "bowling",
            meal: "",
            reason: "no_trusted_match",
            count: 7,
          },
        ],
      ],
      ["/api/v1/admin/planner/concepts", [{ slug: "sweets", kind: "place", role: "meal", example: "sweets" }]],
      [
        "/api/v1/admin/planner/misses",
        [
          {
            id: "m1",
            fragment: "7elwe",
            locale: "arabizi",
            count: 4,
            first_seen: "2026-09-01T10:00:00Z",
            last_seen: "2026-09-20T10:00:00Z",
            status: "open",
          },
        ],
      ],
      [
        "/api/v1/admin/planner/phrases",
        [
          {
            id: "p1",
            phrase: "zawarib",
            concept: "old-town",
            locale: "ar-LB",
            status: "approved",
            source: "staff",
            created_at: "2026-09-01T10:00:00Z",
            retired_at: null,
          },
        ],
      ],
      ["/api/v1/venues/place-types", TYPES],
    ]);
    const { container } = render(wrap(<PlannerLanguageAdmin />));

    const row = (await screen.findByText("Activity · Bowling")).closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("batroun");
    expect(row).toHaveTextContent("No trusted place of this kind here yet.");
    expect(row).toHaveTextContent("7");

    const miss = (await screen.findByText("7elwe")).closest("li") as HTMLElement;
    expect(miss).toHaveTextContent("4×");
    const teach = within(miss).getByRole("button", { name: "Teach this phrase" });
    expect(teach).toBeDisabled(); // a concept must be chosen first
    fireEvent.change(within(miss).getByLabelText("It means"), { target: { value: "sweets" } });
    expect(within(miss).getByLabelText("Language")).toHaveValue("arabizi");
    fireEvent.click(teach);
    await waitFor(() =>
      expect(calls.find((call) => call.method === "POST" && call.url.endsWith("/misses/m1"))?.body).toEqual({
        decision: "phrase",
        phrase: "7elwe",
        concept: "sweets",
        locale: "arabizi",
      }),
    );

    const phrase = (await screen.findByText("zawarib")).closest("li") as HTMLElement;
    expect(phrase).toHaveTextContent("Lebanese Arabic");
    fireEvent.click(within(phrase).getByRole("button", { name: "Retire" }));
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/phrases/p1/retire"))).toBe(true));
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("catalogue growth", () => {
  const LEAD = {
    id: "l1",
    source: "osm",
    external_id: "node/42",
    name: "Strike Lanes",
    name_ar: "",
    name_fr: "",
    lat: 34.25,
    lng: 35.65,
    place_type: "bowling",
    destination_slug: "batroun",
    status: "new",
    reason: "",
    duplicate_of: null,
    experience_id: null,
    created_at: "2026-09-20T10:00:00Z",
    demand: 7,
  };
  const DUE = {
    price_rule_id: "r1",
    experience_id: "e1",
    slug: "jeita",
    title: "Jeita Grotto",
    price_type: "fixed",
    amount_minor: 1800,
    max_amount_minor: null,
    currency: "USD",
    unit: "person",
    source_url: "https://example.org/tickets",
    source_name: "Official ticket page",
    checked_on: "2026-06-01",
    review_by: "2026-10-01",
    note: "",
  };

  it("queues leads by demand, publishes only after a check, and records prices with their source", async () => {
    const calls = route([
      ["/api/v1/admin/leads/l1/publish", { ...LEAD, status: "published", slug: "strike-lanes-batroun" }],
      ["/api/v1/admin/leads", [LEAD]],
      ["/api/v1/admin/prices/due", [DUE]],
      ["/api/v1/admin/prices/listings/e1", DUE],
      ["/api/v1/admin/place-types/coverage", { place_types: TYPES, destinations: [] }],
      ["/api/v1/destinations", []],
    ]);
    const { container } = render(wrap(<CatalogueGrowthAdmin />));
    const lead = (await screen.findByText("Strike Lanes")).closest("li") as HTMLElement;
    expect(lead).toHaveTextContent("Asked for 7× and not found");
    expect(lead).toHaveTextContent("Source: osm node/42");
    expect(within(lead).getByRole("button", { name: "Reject" })).toBeDisabled(); // a reason is required

    fireEvent.click(within(lead).getByRole("button", { name: "Publish after the check" }));
    const publish = within(lead).getByRole("button", { name: "Publish listing" });
    expect(publish).toBeDisabled();
    fireEvent.change(within(lead).getByLabelText("Description for travellers"), {
      target: { value: "A ten-lane bowling alley by the Batroun coast road." },
    });
    fireEvent.change(within(lead).getByLabelText("What you checked, and how (visit or call)"), {
      target: { value: "Visited on 24 September; lanes open." },
    });
    fireEvent.click(publish);
    expect(await within(lead).findByRole("status")).toHaveTextContent("Published as strike-lanes-batroun");

    const due = (await screen.findByText(/Jeita Grotto/)).closest("li") as HTMLElement;
    expect(due).toHaveTextContent("$18.00");
    expect(within(due).getByRole("link")).toHaveAttribute("href", "https://example.org/tickets");
    fireEvent.click(within(due).getByRole("button", { name: "Record again" }));
    expect(screen.getByLabelText("Listing ID")).toHaveValue("e1");
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save price" }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === "PUT")?.body).toMatchObject({
        price_type: "fixed",
        amount_minor: 2000,
        currency: "USD",
        source_url: "https://example.org/tickets",
        source_name: "Official ticket page",
      }),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
