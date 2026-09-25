/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { CatalogueGrowthAdmin } from "./catalogue-growth";
import { IntentReleases, PhraseReview } from "./phrase-review";
import { PlannerLanguageAdmin } from "./planner-language";
import { LocaleProvider } from "@/components/shell/locale-provider";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

/** First matching prefix wins; POST/PUT bodies are recorded. A number as the body answers with that status. */
function route(handlers: [string, unknown][]) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const hit = handlers.find(([prefix]) => url.startsWith(prefix));
      if (hit && typeof hit[1] === "number") return jsonResponse({ detail: "refused" }, hit[1]);
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
      [
        "/api/v1/admin/prices/worklist",
        [
          {
            experience_id: "e9",
            slug: "harbour-lanes",
            title: "Harbour Lanes",
            listing_kind: "experience",
            destination_slug: "batroun",
            place_types: ["bowling"],
            current_price_type: "quote-required",
            planned: 4,
            last_source: null,
          },
        ],
      ],
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
    fireEvent.change(within(lead).getByLabelText("Wheelchair access"), { target: { value: "no" } });
    fireEvent.change(within(lead).getByLabelText("Parking"), { target: { value: "yes" } });
    fireEvent.click(within(lead).getByLabelText(/I took the name and location on site/));
    expect(publish).toBeDisabled(); // the name on the sign and the point are needed
    fireEvent.change(within(lead).getByLabelText("Name on the sign"), { target: { value: "Strike Lanes Batroun" } });
    fireEvent.change(within(lead).getByLabelText("Latitude, longitude taken there"), {
      target: { value: "34.2553, 35.6581" },
    });
    fireEvent.click(publish);
    expect(await within(lead).findByRole("status")).toHaveTextContent("Published as strike-lanes-batroun");
    expect(calls.find((call) => call.url.endsWith("/l1/publish"))?.body).toMatchObject({
      facts: { wheelchair_access: false, parking: true },
      on_site: { name: "Strike Lanes Batroun", lat: 34.2553, lng: 35.6581 },
    });
    expect(screen.getByRole("link", { name: "Download the field sheet (CSV)" })).toHaveAttribute(
      "href",
      "/api/v1/admin/leads/field-sheet?status=new",
    );
    const work = within(await screen.findByRole("list", { name: "Places with no published price" })).getByRole(
      "listitem",
    );
    expect(work).toHaveTextContent("Planned 4× in 90 days");
    fireEvent.click(within(work).getByRole("button", { name: "Record its price" }));
    expect(screen.getByLabelText("Listing ID")).toHaveValue("e9");

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

describe("phrase review and releases", () => {
  const CANDIDATES = [
    {
      id: "c1",
      phrase: "7elwiyet",
      concept: "sweets",
      locale: "arabizi",
      source: "generated_variant",
      batch: "seed-v1",
      variant_of: "7elwayet",
      note: "spelling of 7elwayet",
      status: "candidate",
    },
    {
      id: "c2",
      phrase: "apres le dejeuner",
      concept: "time-afternoon",
      locale: "fr",
      source: "seed",
      batch: "seed-v1",
      variant_of: "",
      note: "also reads as meal-lunch",
      status: "candidate",
    },
  ];

  it("approves a selection of candidates and flags clashes", async () => {
    const calls = route([
      [
        "/api/v1/admin/planner/candidates/batches",
        [{ batch: "seed-v1", candidate: 2, approved: 0, rejected: 0, locales: {}, first_added: "2026-09-25" }],
      ],
      ["/api/v1/admin/planner/candidates/review", { approved: 1, rejected: 0, duplicates: 0 }],
      ["/api/v1/admin/planner/candidates", { total: 2, items: CANDIDATES }],
    ]);
    const onChanged = vi.fn();
    const { container } = render(wrap(<PhraseReview concepts={[]} onChanged={onChanged} />));
    const first = (await screen.findByText("7elwiyet")).closest("li") as HTMLElement;
    expect(first).toHaveTextContent("spelling of 7elwayet");
    const second = screen.getByText("apres le dejeuner").closest("li") as HTMLElement;
    expect(second).toHaveTextContent("Also reads as another concept");
    expect(screen.getByText(/2 to review/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve selected" })).toBeDisabled();
    fireEvent.click(within(first).getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Approve selected" }));
    await waitFor(() =>
      expect(calls.find((call) => call.url.endsWith("/candidates/review"))?.body).toEqual({
        ids: ["c1"],
        decision: "approve",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("1 approved");
    expect(onChanged).toHaveBeenCalled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("shows whether the live phrases are released, and says so when the gate refuses a release", async () => {
    route([
      [
        "/api/v1/admin/planner/releases",
        {
          current_checksum: "new",
          approved_phrases: 12,
          releases: [
            {
              id: "r1",
              name: "intent-data-v1",
              version: 1,
              approved_phrases: 10,
              checksum: "old",
              metrics: {
                generated: {
                  cases: 1200,
                  case_accuracy: 1,
                  step_accuracy: 1,
                  order_accuracy: 1,
                  passes: true,
                  failures: [],
                },
              },
              note: "first seed",
              released_at: "2026-09-20T10:00:00Z",
            },
          ],
        },
      ],
    ]);
    render(wrap(<IntentReleases version={0} />));
    expect(await screen.findByText(/12 approved phrases; changes since the last release/)).toBeInTheDocument();
    expect(screen.getByText(/Generated set: 1200 prompts, 100% read right/)).toBeInTheDocument();
    vi.unstubAllGlobals();
    route([["/api/v1/admin/planner/releases", 422]]);
    fireEvent.click(screen.getByRole("button", { name: "Measure and release" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Refused");
  });
});
