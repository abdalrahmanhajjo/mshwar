import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanFlow } from "./plan-flow";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { Destination } from "@/lib/catalog";
import type { DayStepOutcome, PlannerSession } from "@/lib/planner";
import { plannerCopy } from "@/lib/planner-copy";

const destinations: Destination[] = [
  {
    slug: "byblos",
    name: "Byblos",
    region: "Mount Lebanon",
    country: "Lebanon",
    blurb: "Old harbour",
    tags: [],
    image: "",
    imageAlt: "",
  },
];

function apiItem(slug: string, title: string) {
  return {
    slug,
    title,
    category: "culture",
    destination_slug: "byblos",
    place_label: "Byblos",
    hours: 2,
    body: "A nice place",
    summary: "A nice place",
    tags: [],
    booking_mode: "request",
    price: { type: "from", amount: 20, amount_minor: 2000, currency: "USD", unit: "person" },
  };
}

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

describe("plan flow (manual mode)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("switches to manual, picks a destination, loads places and reaches Save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ items: [apiItem("harbour-walk", "Harbour walk")] }),
      })),
    );
    render(wrap(<PlanFlow destinations={destinations} />));

    fireEvent.click(screen.getByRole("tab", { name: /Build it myself/ }));
    expect(screen.getByText("Where do you want to go?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Byblos/ }));
    // The chosen town is echoed back as a chip that can be tapped off again.
    expect(screen.getByRole("button", { name: "Remove: Byblos" })).toBeInTheDocument();

    // Day settings come first: opening hours and traffic both depend on them.
    fireEvent.click(screen.getByRole("button", { name: "Next: your day" }));
    expect(await screen.findByText("Trip details")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next: pick places" }));
    expect(await screen.findByText("Harbour walk")).toBeInTheDocument();
    // Nothing picked yet, so the day says what to do rather than sitting empty.
    expect(screen.getByText(/Nothing picked yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save itinerary/ })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("button", { name: /Save itinerary/ })).toBeEnabled();
  });
});

const noPlan: PlannerSession = {
  session_id: "session-1",
  status: "infeasible",
  degraded: false,
  degraded_message: null,
  constraints: {},
  assumed_defaults: [],
  clarifications: [],
  plan: null,
};

const planned: PlannerSession = {
  ...noPlan,
  status: "planned",
  plan: {
    trip_id: "trip-1",
    trip_title: "Byblos day",
    version_id: "version-1",
    version: 1,
    origin: "ai",
    sealed_at: null,
    window_start: "2026-09-26T09:00:00+03:00",
    return_by: "2026-09-26T18:00:00+03:00",
    party_size: 2,
    budget_minor: 30000,
    currency: "USD",
    strict_budget: false,
    constraints: {},
    validation: {},
    stops: [
      {
        id: "stop-1",
        experience_id: "experience-1",
        position: 1,
        starts_at: "2026-09-26T10:00:00+03:00",
        ends_at: "2026-09-26T12:00:00+03:00",
        estimated_minor: 4000,
        price_kind: "estimate",
        locked: false,
        snapshot: { title: "Harbour walk" },
      },
    ],
    legs: [],
    cost_items: [],
    total_minor: 4000,
  },
};

function openAiDetails() {
  render(wrap(<PlanFlow destinations={destinations} />));
  fireEvent.click(screen.getByRole("button", { name: /Byblos/ }));
  fireEvent.click(screen.getByRole("button", { name: plannerCopy.en.flowContinue }));
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

describe("plan flow generation results", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows every returned day step and its reason even when no plan could be saved", async () => {
    const requested: [DayStepOutcome["role"], string][] = [
      ["exchange", "change currency"],
      ["meal", "breakfast at a sweets place"],
      ["sight", "see a mountain"],
      ["meal", "eat dinner"],
      ["activity", "play bowling"],
      ["activity", "watch a film at the cinema"],
      ["stay", "stay the night at a hotel"],
    ];
    const day: DayStepOutcome[] = requested.map(([role, text], index) => ({
      order: index + 1,
      role,
      text,
      tags: [],
      meal: null,
      status: "empty",
      reason: "no_trusted_match",
      starts_at: null,
      ends_at: null,
      travel_minutes: null,
      wait_minutes: 0,
      experience_id: null,
      slug: null,
      title: null,
      destination_slug: null,
      office: null,
      trust: {},
      flags: [],
      named_place: null,
      price: null,
      actions: {},
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => jsonResponse(String(url).endsWith("/planner/sessions") ? { ...noPlan, day } : [])),
    );
    openAiDetails();
    fireEvent.click(screen.getByRole("button", { name: plannerCopy.en.flowGenerate }));
    const timeline = await screen.findByRole("list", { name: "Day 1" });
    const steps = within(timeline).getAllByRole("listitem");
    expect(steps).toHaveLength(7);
    requested.forEach(([, text], index) => {
      expect(steps[index]).toHaveTextContent(text);
      expect(steps[index]).toHaveTextContent(plannerCopy.en.reason_no_trusted_match);
    });
    expect(screen.queryByText(plannerCopy.en.flowReviewHint)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: plannerCopy.en.lock })).not.toBeInTheDocument();
  });

  it("explains an infeasible result, preserves details, and only reports saved after a successful retry", async () => {
    let finish: (session: PlannerSession) => void = () => undefined;
    const generated = new Promise<PlannerSession>((resolve) => {
      finish = resolve;
    });
    let attempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).endsWith("/planner/sessions")) {
          attempts += 1;
          return jsonResponse(attempts === 1 ? await generated : planned);
        }
        return jsonResponse([]);
      }),
    );
    openAiDetails();
    fireEvent.change(screen.getByLabelText(plannerCopy.en.flowBudgetLabel), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText(plannerCopy.en.flowVibeLabel), {
      target: { value: "Breakfast and a mountain walk" },
    });
    fireEvent.click(screen.getByRole("button", { name: plannerCopy.en.flowGenerate }));
    expect(screen.getByText(plannerCopy.en.flowGenerating)).toBeInTheDocument();
    expect(screen.queryByText(plannerCopy.en.flowReviewHint)).not.toBeInTheDocument();
    finish(noPlan);
    expect(await screen.findByText(plannerCopy.en.flowNoPlanHint)).toBeInTheDocument();
    expect(screen.queryByText(plannerCopy.en.flowReviewHint)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: plannerCopy.en.flowEditDetails }));
    expect(screen.getByLabelText(plannerCopy.en.flowBudgetLabel)).toHaveValue(300);
    expect(screen.getByLabelText(plannerCopy.en.flowVibeLabel)).toHaveValue("Breakfast and a mountain walk");
    fireEvent.click(screen.getByRole("button", { name: plannerCopy.en.flowGenerate }));
    expect(await screen.findByText("Harbour walk")).toBeInTheDocument();
    expect(screen.getByText(plannerCopy.en.flowReviewHint)).toBeInTheDocument();
    expect(screen.queryByText(plannerCopy.en.flowNoPlanHint)).not.toBeInTheDocument();
  });

  it("renders clarification questions and submits the answer before displaying a plan", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url).endsWith("/planner/sessions")) {
        return jsonResponse({
          ...noPlan,
          status: "clarifying",
          clarifications: [{ field: "intent_anchor", prompt: "Which region or kind of day?", required: true }],
        });
      }
      if (String(url).endsWith("/clarify")) return jsonResponse(planned);
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);
    openAiDetails();
    fireEvent.click(screen.getByRole("button", { name: plannerCopy.en.flowGenerate }));
    fireEvent.change(await screen.findByLabelText("Which region or kind of day?"), { target: { value: "Byblos" } });
    expect(screen.queryByText(plannerCopy.en.flowReviewHint)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: plannerCopy.en.clarify }));
    expect(await screen.findByText("Harbour walk")).toBeInTheDocument();
    const request = fetchMock.mock.calls.find(([url]) => url.endsWith("/clarify"));
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      answers: { intent_anchor: "Byblos", party_size: 2 },
    });
  });

  it("keeps a failed request recoverable without claiming a trip was saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ detail: "Planning is temporarily unavailable" }, 503)),
    );
    openAiDetails();
    fireEvent.click(screen.getByRole("button", { name: plannerCopy.en.flowGenerate }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Planning is temporarily unavailable");
    expect(screen.getByRole("button", { name: plannerCopy.en.flowEditDetails })).toBeEnabled();
    expect(screen.queryByText(plannerCopy.en.flowReviewHint)).not.toBeInTheDocument();
  });
});
