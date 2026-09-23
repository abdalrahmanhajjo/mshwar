import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rowsToProposal } from "./engagement-detail";
import { HireAGuide } from "./hire-a-guide";
import { ProposalDiff } from "./proposal-diff";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { beirutTime, withBeirutTime, type Engagement, type MatchedGuide, type Proposal } from "@/lib/guide-hire";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

function route(handlers: [string, unknown][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const hit = handlers.find(([prefix]) => url.startsWith(prefix));
      return hit ? jsonResponse(hit[1]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

const MATCH: MatchedGuide = {
  id: "g1",
  slug: "rami",
  tier: "licensed",
  badge: true,
  display_name: "Rami",
  headline: "Byblos, slowly",
  bio: "",
  languages: ["ar", "en"],
  regions: ["byblos"],
  specialities: [],
  years_guiding: 8,
  status: "approved",
  organization_id: "o1",
  day_rate_minor: 12000,
  max_group: 8,
  hireable: true,
  matched_regions: ["byblos"],
  matched_language: true,
  score: 18,
};

const PROPOSAL: Proposal = {
  against_version_id: "v1",
  stops: [],
  diff: {
    added: [
      {
        slug: "souk",
        title: "Old souk",
        position: 2,
        starts_at: "2099-05-02T08:45:00Z",
        ends_at: "2099-05-02T09:45:00Z",
      },
    ],
    removed: [{ stop_id: "s3", title: "Wax museum", position: 3 }],
    retimed: [
      {
        stop_id: "s2",
        title: "Harbour",
        from_starts_at: "2099-05-02T09:00:00Z",
        from_ends_at: "2099-05-02T10:30:00Z",
        starts_at: "2099-05-02T10:00:00Z",
        ends_at: "2099-05-02T11:30:00Z",
      },
    ],
    moved: [],
  },
  note: "Quieter after the souk",
  rate_minor: 15000,
  proposed_at: "2099-04-01T00:00:00Z",
};

describe("hiring a guide", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads and writes Beirut wall-clock times", () => {
    expect(beirutTime("2099-05-02T07:00:00Z")).toBe("10:00");
    expect(beirutTime(withBeirutTime("2099-05-02T07:00:00Z", "11:30"))).toBe("11:30");
  });

  it("sends kept stops by id and new places by handle, in time order", () => {
    const body = rowsToProposal([
      {
        key: "b",
        stop_id: "s2",
        title: "B",
        locked: false,
        starts_at: "2099-01-01T10:00:00Z",
        ends_at: "2099-01-01T11:00:00Z",
      },
      {
        key: "n",
        slug: "souk",
        title: "souk",
        locked: false,
        starts_at: "2099-01-01T09:00:00Z",
        ends_at: "2099-01-01T09:30:00Z",
      },
    ]);
    expect(body).toEqual([
      { slug: "souk", starts_at: "2099-01-01T09:00:00Z", ends_at: "2099-01-01T09:30:00Z" },
      { stop_id: "s2", starts_at: "2099-01-01T10:00:00Z", ends_at: "2099-01-01T11:00:00Z" },
    ]);
  });

  it("shows a counter-proposal as what changes against the plan", () => {
    render(wrap(<ProposalDiff proposal={PROPOSAL} currentRate={12000} />));
    expect(screen.getByText(/Old souk/)).toBeInTheDocument();
    expect(screen.getByText("Wax museum")).toHaveClass("line-through");
    expect(screen.getByText(/13:00–14:30/)).toBeInTheDocument();
    expect(screen.getByText(/Day rate: \$150\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Quieter after the souk/)).toBeInTheDocument();
  });

  it("offers matched guides for the latest version and sends the ask with the group's notes", async () => {
    const calls = route([
      [
        "/api/v1/planner/trips/t1/versions",
        [
          { version_id: "v1", version: 1, origin: "manual", sealed_at: null, created_at: "" },
          { version_id: "v2", version: 2, origin: "manual", sealed_at: null, created_at: "" },
        ],
      ],
      ["/api/v1/guides/trips/t1/engagements", []],
      ["/api/v1/guides/match", [MATCH]],
      ["/api/v1/guides/engagements", { id: "e1", state: "requested" } as Partial<Engagement>],
    ]);
    render(wrap(<HireAGuide tripId="t1" />));
    expect(await screen.findByText("$120.00 a day")).toBeInTheDocument();
    expect(calls.some((call) => call.url.includes("version_id=v2"))).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Ask Rami" }));
    fireEvent.change(screen.getByLabelText("Food needs"), { target: { value: "vegetarian" } });
    fireEvent.click(screen.getByRole("button", { name: /Send request/ }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === "POST")).toBe(true));
    const sent = calls.find((call) => call.init?.method === "POST");
    expect(JSON.parse(String(sent?.init?.body))).toMatchObject({
      version_id: "v2",
      guide_slug: "rami",
      party_notes: { dietary: "vegetarian" },
    });
  });

  it("asks for a saved plan before offering guides", async () => {
    route([
      ["/api/v1/planner/trips/t1/versions", []],
      ["/api/v1/guides/trips/t1/engagements", []],
    ]);
    render(wrap(<HireAGuide tripId="t1" />));
    expect(await screen.findByText(/Save a plan first/)).toBeInTheDocument();
  });
});
