/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { DayTimeline } from "./day-timeline";
import { UnderstoodSteps } from "./understood-steps";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { plannerCopy } from "@/lib/planner-copy";
import type { DayStepOutcome, PlanDocument, PriceLine } from "@/lib/planner";

const copy = plannerCopy.en;

const price = (overrides: Partial<PriceLine>): PriceLine => ({
  order: 1,
  kind: "stop",
  label: "Place",
  basis: "fixed",
  unit: "person",
  quantity: 2,
  unit_low_minor: 800,
  unit_high_minor: 800,
  low_minor: 1600,
  high_minor: 1600,
  currency: "USD",
  source: "owner",
  note: "",
  ...overrides,
});

const step = (overrides: Partial<DayStepOutcome>): DayStepOutcome => ({
  order: 1,
  role: "meal",
  tags: [],
  meal: null,
  text: "",
  status: "filled",
  reason: null,
  starts_at: "2026-10-01T05:17:00Z",
  ends_at: "2026-10-01T05:57:00Z",
  travel_minutes: 12,
  wait_minutes: 0,
  experience_id: null,
  slug: null,
  title: null,
  destination_slug: "batroun",
  office: null,
  trust: {},
  flags: [],
  named_place: null,
  price: null,
  actions: {},
  ...overrides,
});

const STEPS: DayStepOutcome[] = [
  step({
    order: 1,
    role: "exchange",
    status: "office",
    office: { branch_name: "Batroun branch", phone: "+961 6 123 456", changer: { bdl_number: "A-12" } },
    price: price({ kind: "exchange", basis: "exchange_rate", low_minor: null, high_minor: null }),
    starts_at: "2026-10-01T05:01:00Z",
    ends_at: "2026-10-01T05:16:00Z",
  }),
  step({
    order: 2,
    title: "Knefeh House",
    experience_id: "exp-knefeh",
    trust: { level: "checked_by_mshwar" },
    price: price({ basis: "typical_spend" }),
    actions: { reservation_whatsapp: "+961 3 000 000", reservation_url: "https://example.org/reserve" },
  }),
  step({
    order: 3,
    role: "activity",
    status: "empty",
    reason: "no_trusted_match",
    text: "play bowling",
    starts_at: null,
    ends_at: null,
  }),
  step({
    order: 4,
    role: "activity",
    title: "Coast Cinema",
    experience_id: "exp-cinema",
    trust: { level: "verified_organisation" },
    flags: ["check_times", "estimated_price"],
    wait_minutes: 90,
    price: price({ basis: "on_request", low_minor: null, high_minor: null }),
  }),
  step({
    order: 5,
    role: "stay",
    title: "Harbour Hotel",
    experience_id: "exp-hotel",
    trust: { level: "licensed_claimed" },
    actions: { booking_url: "https://example.org/book", check_in: "14:00:00" },
    price: price({
      kind: "stay",
      basis: "per_night_from",
      unit: "night",
      quantity: 1,
      low_minor: 9000,
      high_minor: null,
    }),
  }),
];

const PLAN = {
  stops: [
    { id: "stop-knefeh", experience_id: "exp-knefeh", locked: false },
    { id: "stop-cinema", experience_id: "exp-cinema", locked: true },
    { id: "stop-hotel", experience_id: "exp-hotel", locked: false },
  ],
} as unknown as PlanDocument;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("day timeline", () => {
  it("shows every step asked for, in order, with trust, warnings, prices and actions", async () => {
    const { container } = render(
      <LocaleProvider>
        <DayTimeline steps={STEPS} plan={PLAN} copy={copy} />
      </LocaleProvider>,
    );
    const items = within(screen.getByRole("list", { name: "Day 1" })).getAllByRole("listitem");
    expect(items).toHaveLength(5);

    expect(items[0]).toHaveTextContent("Batroun branch");
    expect(items[0]).toHaveTextContent("Registered money changer");
    expect(within(items[0]).getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:+9616123456");

    expect(items[1]).toHaveTextContent("Visited by Mshwar");
    expect(items[1]).toHaveTextContent("$16.00");
    expect(within(items[1]).getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/9613000000",
    );
    expect(within(items[1]).getByRole("link", { name: "Reserve online" })).toHaveAttribute(
      "href",
      "https://example.org/reserve",
    );

    expect(items[2]).toHaveTextContent("Not filled");
    expect(items[2]).toHaveTextContent("No trusted place of this kind here yet.");
    expect(items[2]).toHaveTextContent("You asked for: play bowling");

    expect(items[3]).toHaveTextContent("Check showtimes");
    expect(items[3]).toHaveTextContent("Price on request");
    expect(items[3]).toHaveTextContent("90 min free before");
    expect(items[3]).not.toHaveTextContent("Price not fixed");

    expect(items[4]).toHaveTextContent("Licence checked");
    expect(items[4]).toHaveTextContent("from $90.00");
    expect(items[4]).toHaveTextContent("Check-in from 14:00");
    expect(within(items[4]).getByRole("link", { name: "Book the stay" })).toHaveAttribute(
      "href",
      "https://example.org/book",
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("locks and unlocks a step's place", async () => {
    const calls: string[] = [];
    globalThis.fetch = vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ session_id: "s1", status: "planned" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    const onLock = vi.fn(async (task: () => Promise<unknown>) => {
      await task();
    });
    render(
      <LocaleProvider>
        <DayTimeline steps={STEPS} plan={PLAN} copy={copy} sessionId="s1" onLock={onLock} />
      </LocaleProvider>,
    );
    const buttons = screen.getAllByRole("button").filter((button) => button.hasAttribute("aria-pressed"));
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(calls).toEqual(["/api/v1/planner/sessions/s1/lock"]));
    expect(onLock).toHaveBeenCalledTimes(1);
  });
});

describe("day timeline, step options and trips", () => {
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("offers other trusted places for a step, with their prices, and uses the one chosen", async () => {
    const calls: { url: string; body?: string }[] = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body as string | undefined });
      if (String(url).includes("/alternatives")) {
        return json([
          {
            experience_id: "exp-knefeh",
            slug: "knefeh-house",
            title: "Knefeh House",
            destination_slug: "batroun",
            place_types: ["sweets"],
            trust: { level: "checked_by_mshwar" },
            distance_m: 0,
            outside_destination: false,
            needs_schedule: false,
            price: price({}),
          },
          {
            experience_id: "exp-sweets",
            slug: "old-sweets",
            title: "Old Sweets",
            destination_slug: "batroun",
            place_types: ["sweets"],
            trust: { level: "verified_organisation" },
            distance_m: 1200,
            outside_destination: false,
            needs_schedule: false,
            price: price({ basis: "on_request", low_minor: null, high_minor: null }),
          },
        ]);
      }
      return json({ session_id: "s1", status: "planned" });
    }) as unknown as typeof fetch;
    const onLock = vi.fn(async (task: () => Promise<unknown>) => {
      await task();
    });
    const { container } = render(
      <LocaleProvider>
        <DayTimeline steps={STEPS} plan={PLAN} copy={copy} sessionId="s1" onLock={onLock} />
      </LocaleProvider>,
    );
    const knefeh = within(screen.getByRole("list", { name: "Day 1" })).getAllByRole("listitem")[1];
    fireEvent.click(within(knefeh).getByRole("button", { name: "Other options" }));
    const option = await within(knefeh).findByText("Old Sweets");
    expect(within(knefeh).queryAllByText("Knefeh House")).toHaveLength(1); // the current place is not offered again
    const row = option.closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Verified business");
    expect(row).toHaveTextContent("1.2 km from the step before");
    expect(row).toHaveTextContent("Price on request");
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(within(row).getByRole("button", { name: "Use this place" }));
    await waitFor(() =>
      expect(calls.map((call) => call.url)).toEqual([
        "/api/v1/planner/sessions/s1/steps/2/alternatives?day=1",
        "/api/v1/planner/sessions/s1/steps/2/choose?day=1",
      ]),
    );
    expect(JSON.parse(calls[1].body ?? "{}")).toEqual({ experience_id: "exp-sweets" });
  });

  it("groups a trip of several days under day headings and flags unconfirmed needs", () => {
    const trip = [
      step({ order: 1, day: 1, title: "Byblos Castle", role: "sight", experience_id: "a" }),
      step({ order: 2, day: 1, title: "Harbour Hotel", role: "stay", experience_id: "b" }),
      step({ order: 1, day: 2, title: "Cedars", role: "sight", experience_id: "c", flags: ["needs_unconfirmed"] }),
    ];
    render(
      <LocaleProvider>
        <DayTimeline steps={trip} plan={{ stops: [] } as unknown as PlanDocument} copy={copy} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "Day 1" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Day 1" })).getAllByRole("listitem")).toHaveLength(2);
    const second = within(screen.getByRole("list", { name: "Day 2" })).getAllByRole("listitem");
    expect(second[0]).toHaveTextContent("Cedars");
    expect(second[0]).toHaveTextContent("Your needs not confirmed here");
  });
});

describe("what I understood", () => {
  function mockApi(understood: unknown) {
    const reads: unknown[] = [];
    globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const reply = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
      if (String(url).endsWith("/venues/place-types")) {
        return reply([
          { slug: "sweets", names: { en: "Sweets and knefeh", ar: "حلويات", fr: "Pâtisserie" } },
          { slug: "hotel", names: { en: "Hotel", ar: "فندق", fr: "Hôtel" } },
          { slug: "seafood", names: { en: "Seafood", ar: "مأكولات بحرية", fr: "Fruits de mer" } },
        ]);
      }
      reads.push(JSON.parse(String(init?.body)));
      return reply(understood);
    }) as unknown as typeof fetch;
    return reads;
  }

  it("reads the typed day into steps before anything is planned", async () => {
    const reads = mockApi({
      steps: [
        { order: 1, role: "exchange", tags: ["money-changer"], meal: null, optional: false },
        { order: 2, role: "meal", tags: ["sweets"], meal: "breakfast", optional: false },
        { order: 3, role: "activity", tags: [], meal: null, optional: true },
        { order: 4, role: "stay", tags: ["hotel"], meal: null, optional: false },
      ],
      transport: "driver",
      pickup_requested: true,
      ends_overnight: true,
      avoid_tags: ["seafood"],
      unparsed: ["something fun"],
      destination_slugs: ["batroun"],
      plans_as_day: true,
    });
    render(
      <LocaleProvider>
        <UnderstoodSteps text="changer, then sweets for breakfast, maybe fun, then a hotel" copy={copy} />
      </LocaleProvider>,
    );
    expect(await screen.findByText("Here's your day as I understood it", {}, { timeout: 2000 })).toBeInTheDocument();
    expect(reads).toHaveLength(1);
    expect(screen.getByText("1. Money changer")).toBeInTheDocument();
    expect(screen.getByText("2. Breakfast: Sweets and knefeh")).toBeInTheDocument();
    expect(screen.getByText("3. Activity (if there is time)")).toBeInTheDocument();
    expect(screen.getByText("4. Night: Hotel")).toBeInTheDocument();
    expect(screen.getByText("With a driver")).toBeInTheDocument();
    expect(screen.getByText("Ends with a night away")).toBeInTheDocument();
    expect(screen.getByText("Not: Seafood")).toBeInTheDocument();
    expect(screen.getByText("Not sure what you meant by: something fun")).toBeInTheDocument();
  });

  it("stays quiet for a single wish or text too short to read", async () => {
    const reads = mockApi({
      steps: [{ order: 1, role: "sight", tags: [], meal: null, optional: false }],
      transport: null,
      pickup_requested: false,
      ends_overnight: false,
      avoid_tags: [],
      unparsed: [],
      destination_slugs: [],
      plans_as_day: false,
    });
    const { rerender } = render(
      <LocaleProvider>
        <UnderstoodSteps text="a slow day in Byblos" copy={copy} />
      </LocaleProvider>,
    );
    await waitFor(() => expect(reads).toHaveLength(1), { timeout: 2000 });
    expect(screen.queryByText("Here's your day as I understood it")).not.toBeInTheDocument();
    rerender(
      <LocaleProvider>
        <UnderstoodSteps text="hi" copy={copy} />
      </LocaleProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(reads).toHaveLength(1);
  });
});
