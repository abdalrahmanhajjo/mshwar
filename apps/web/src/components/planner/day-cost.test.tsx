/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { DayCostPanel, DriverRequestPanel, dayTotal, lineAmount } from "./day-cost";
import { CostPanel } from "./planner-view";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { plannerCopy } from "@/lib/planner-copy";
import type { DayPrice, PlanDocument, PriceLine } from "@/lib/planner";

const copy = plannerCopy.en;

const line = (overrides: Partial<PriceLine>): PriceLine => ({
  order: 1,
  kind: "stop",
  label: "Place",
  basis: "fixed",
  unit: "person",
  quantity: 1,
  unit_low_minor: null,
  unit_high_minor: null,
  low_minor: null,
  high_minor: null,
  currency: "USD",
  source: "price_rule",
  note: "",
  ...overrides,
});

const PRICING: DayPrice = {
  currency: "USD",
  party_size: 2,
  lines: [
    line({ label: "Batroun branch", kind: "exchange", basis: "exchange_rate", unit: "visit" }),
    line({
      label: "Knefeh House",
      basis: "typical_spend",
      quantity: 2,
      unit_low_minor: 800,
      unit_high_minor: 800,
      low_minor: 1600,
      high_minor: 1600,
      note: "The restaurant's own typical spend per person",
    }),
    line({
      label: "Strike Lanes",
      basis: "range",
      quantity: 2,
      unit_low_minor: 1000,
      unit_high_minor: 1500,
      low_minor: 2000,
      high_minor: 3000,
    }),
    line({ label: "Sea Castle", basis: "on_request", unit: "visit" }),
    line({
      label: "Jeita Grotto",
      basis: "fixed",
      quantity: 2,
      unit_low_minor: 1800,
      unit_high_minor: 1800,
      low_minor: 3600,
      high_minor: 3600,
      source: "published_source",
      source_name: "Jeita Grotto official site",
      source_url: "https://example.org/jeita",
      checked_on: "2026-09-20",
    }),
    line({
      label: "Harbour Hotel",
      kind: "stay",
      basis: "per_night_from",
      unit: "night",
      unit_low_minor: 9000,
      low_minor: 9000,
    }),
    line({
      label: "Driver for the day",
      kind: "driver",
      basis: "driver_day_rate",
      unit: "day",
      unit_low_minor: 7000,
      unit_high_minor: 9000,
      low_minor: 7000,
      high_minor: 9000,
    }),
  ],
  low_minor: 19600,
  high_minor: null,
  per_person_low_minor: 9800,
  per_person_high_minor: null,
  priced_lines: 4,
  on_request_lines: 1,
  other_currency_lines: 0,
  budget_minor: 20000,
  budget_status: "may_exceed",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("day cost", () => {
  it("prices every line from what was published and never shows unknown as free", async () => {
    const { container } = render(
      <LocaleProvider>
        <DayCostPanel pricing={PRICING} copy={copy} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("heading", { name: "What the day costs" })).toBeInTheDocument();
    expect(screen.getByText("Price on request")).toBeInTheDocument();
    expect(screen.getByText("Typical spend per person · 2 × $8.00")).toBeInTheDocument();
    expect(screen.getByText("$20.00 – $30.00")).toBeInTheDocument();
    expect(screen.getByText("from $90.00")).toBeInTheDocument();
    expect(screen.getByText("from $196.00")).toBeInTheDocument();
    expect(screen.getByText(/1 on request/)).toBeInTheDocument();
    expect(screen.getByText("May go over your budget of $200.00")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    const proof = screen.getByRole("link", { name: /Published by Jeita Grotto official site · checked/ });
    expect(proof).toHaveAttribute("href", "https://example.org/jeita");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("formats exact, ranged and open totals", () => {
    expect(dayTotal({ ...PRICING, high_minor: 19600 }, copy)).toBe("$196.00");
    expect(dayTotal({ ...PRICING, high_minor: 25000 }, copy)).toBe("$196.00 – $250.00");
    expect(lineAmount(line({ basis: "free", low_minor: 0, high_minor: 0 }), copy)).toBe("$0.00");
  });

  it("shows a stop without a published price as on request in the classic plan too", () => {
    const plan = {
      currency: "USD",
      total_minor: 3000,
      budget_minor: 0,
      cost_items: [],
      stops: [
        { id: "a", title: "Museum", price_kind: "quote", estimated_minor: 0, snapshot: { title: "Museum" } },
        { id: "b", title: "Lunch", price_kind: "fixed", estimated_minor: 3000, snapshot: { title: "Lunch" } },
      ],
    } as unknown as PlanDocument;
    render(<CostPanel plan={plan} copy={copy} />);
    expect(screen.getByText("Price on request")).toBeInTheDocument();
    expect(screen.getByText(/1 on request/)).toBeInTheDocument();
  });

  it("sends the day to verified drivers and says what happens next", async () => {
    const bodies: unknown[] = [];
    globalThis.fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ id: "r1", kind: "day", status: "open" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    render(<DriverRequestPanel sessionId="s1" copy={copy} />);
    const send = screen.getByRole("button", { name: "Ask drivers for prices" });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Where should the driver pick you up?"), {
      target: { value: " Harbour Hotel lobby " },
    });
    fireEvent.click(send);
    await waitFor(() => expect(bodies).toEqual([{ pickup_name: "Harbour Hotel lobby" }]));
    expect(await screen.findByRole("status")).toHaveTextContent("Rides");
  });
});
