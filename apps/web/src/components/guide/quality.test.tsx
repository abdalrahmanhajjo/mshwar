/// <reference types="vitest-axe/extend-expect" />
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideQualityAdmin } from "@/components/admin/guide-quality-admin";
import { GuideLevelBadge } from "./guide-level";
import { GuideProvider } from "./guide-provider";
import { GuideQuality } from "./guide-quality";
import { PublicGuideReviewsSection, ReviewForm, ReviewList } from "./guide-reviews";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { nextLevelGaps, ratedParts, type MyQuality } from "@/lib/guide-quality";

vi.mock("@/components/shell/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1", display_name: "Rami" }, ready: true, auth: { status: "signed-in" } }),
}));

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

function route(handlers: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const method = init?.method ?? "GET";
      const key = Object.keys(handlers)
        .filter((pattern) => {
          const [verb, path] = pattern.includes(" ") ? pattern.split(" ") : ["", pattern];
          return (!verb || verb === method) && url.startsWith(path);
        })
        .sort((a, b) => b.length - a.length)[0];
      return key ? jsonResponse(handlers[key]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

const PROFILE = {
  id: "g1",
  slug: "rami",
  tier: "licensed",
  badge: true,
  display_name: "Rami",
  status: "approved",
  organization_id: "org-1",
  languages: ["en"],
  regions: [],
  specialities: [],
  required_documents: [],
  documents: [],
};

const QUALITY: MyQuality = {
  level: "new",
  earned: "new",
  held_until: null,
  computed_at: "2026-09-29T00:15:00Z",
  stats: {
    completed_runs: 3,
    recent_runs: 2,
    reviews: 2,
    rating: 4.9,
    requests_due: 4,
    answered_24h: 3,
    answered_24h_rate: 0.75,
    median_response_minutes: 200,
    requests_accepted: 3,
    bookings_held: 5,
    guide_cancellations: 0,
    cancel_rate: 0,
    completeness: 0.6,
    profile: { bio: false, languages: true, photos: true, meeting_point: true, schedule: false },
  },
  thresholds: {
    trusted: { completed_runs: 5, rating: 4.6, answered_24h_rate: 0.9, cancel_rate: 0.05 },
    top: { completed_runs: 25, rating: 4.8, median_response_minutes: 120, cancel_rate: 0.02 },
  },
  ranking: {
    score: 0.71,
    boost: 0.05,
    parts: { review: 0.91, response: 0.5, reliability: 0.83, conversion: 0.67, completeness: 0.6, freshness: 0.4 },
  },
  paused_until: null,
  active_strikes: 1,
  strikes: [
    {
      id: "s1",
      kind: "guide_cancellation",
      reason: "Cancelled a confirmed booking less than 72 hours before the start",
      booking_id: "b1",
      automatic: true,
      created_at: "2026-09-10T08:00:00Z",
      expires_at: "2027-09-10T08:00:00Z",
      voided_at: null,
      void_reason: "",
      active: true,
    },
  ],
};

describe("quality helpers", () => {
  it("keeps only rated parts", () => {
    expect(ratedParts({ knowledge: 5, value: null, route: 4 })).toEqual([
      ["knowledge", 5],
      ["route", 4],
    ]);
    expect(ratedParts(null)).toEqual([]);
  });

  it("says what stands between a guide and the next level", () => {
    const gaps = nextLevelGaps(QUALITY);
    expect(gaps.map((gap) => gap.key)).toEqual(["runs", "answered"]);
    expect(gaps[0]).toEqual({ key: "runs", have: "3", need: "5" });
    expect(nextLevelGaps({ ...QUALITY, earned: "top" })).toEqual([]);
  });
});

describe("guide quality screens", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows no badge for a new guide and a named one for Trusted and Top", () => {
    const { container, rerender } = render(wrap(<GuideLevelBadge level="new" />));
    expect(container.textContent).toBe("");
    rerender(wrap(<GuideLevelBadge level="top" />));
    expect(screen.getByText("Top guide")).toBeTruthy();
  });

  it("sends the four parts with a traveller's review", async () => {
    const calls = route({ "/api/v1/guides/reviews": { id: "rv1", direction: "traveller_to_guide", released: false } });
    const { container } = render(wrap(<ReviewForm runId="r1" heading="Hamra on foot" onSent={() => undefined} />));
    fireEvent.click(screen.getAllByRole("radio")[4] as HTMLElement);
    const knowledge = screen.getByRole("radiogroup", { name: "Knowledge" });
    fireEvent.click(within(knowledge).getAllByRole("radio")[3] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: /Send review/ }));
    await waitFor(() => expect(calls.length).toBe(1));
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      run_id: "r1",
      rating: 5,
      parts: { knowledge: 4 },
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("lets the guide reply once, in public", async () => {
    const calls = route({
      "POST /api/v1/guides/reviews/rv1/reply": { id: "rv1", reply: "Thank you, Maya!", replied_at: "now" },
    });
    render(
      wrap(
        <ReviewList
          canReply
          empty=""
          rows={[{ id: "rv1", rating: 5, body: "Knew every alley", created_at: "2026-09-01", parts: { route: 5 } }]}
        />,
      ),
    );
    expect(screen.getByText("Route 5/5")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.change(screen.getByLabelText("Your public reply"), { target: { value: "Thank you, Maya!" } });
    fireEvent.click(screen.getByRole("button", { name: "Post reply" }));
    expect(await screen.findByText("Thank you, Maya!")).toBeTruthy();
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ body: "Thank you, Maya!" });
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("shows part averages and the guide's reply on the public page", () => {
    render(
      wrap(
        <PublicGuideReviewsSection
          guideName="Rami"
          reviews={{
            count: 2,
            average: 4.5,
            parts: { knowledge: 4.5, communication: null, value: 4, route: null },
            recent: [
              {
                rating: 5,
                body: "Knew every alley",
                created_at: "2026-09-01",
                author: "Maya",
                reply: "Thank you, Maya!",
              },
            ],
          }}
        />,
      ),
    );
    expect(screen.getByText("Knowledge")).toBeTruthy();
    expect(screen.getByText("4.5")).toBeTruthy();
    expect(screen.queryByText("Communication")).toBeNull();
    expect(screen.getByText("Reply from Rami")).toBeTruthy();
  });

  it("shows the guide their level, what to fix, ranking parts and strikes", async () => {
    route({ "/api/v1/guides/me/quality": QUALITY, "/api/v1/guides/me": PROFILE });
    const { container } = render(wrap(<GuideProvider>{<GuideQuality />}</GuideProvider>));
    expect(await screen.findByText(/Your level: New guide/)).toBeTruthy();
    expect(screen.getByText("To reach Trusted guide")).toBeTruthy();
    expect(screen.getByText("Completed tours: 3 of 5")).toBeTruthy();
    expect(screen.getByText("Requests answered within 24 h: 75% (needs 90%)")).toBeTruthy();
    expect(screen.getByRole("meter", { name: "Reply speed" }).getAttribute("aria-valuenow")).toBe("50");
    expect(screen.getByText(/Answer requests quickly/)).toBeTruthy();
    expect(screen.getByText("Late cancellation", { exact: false })).toBeTruthy();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("lets an admin add a strike and hide a review with a reason", async () => {
    const guide = {
      id: "g1",
      slug: "rami",
      display_name: "Rami",
      status: "approved",
      level: "trusted",
      earned: "trusted",
      held_until: null,
      score: 0.8123,
      stats: {},
      computed_at: null,
      paused_until: null,
      active_strikes: 0,
      strikes: [],
    };
    const review = {
      id: "rv1",
      direction: "traveller_to_guide",
      rating: 1,
      body: "Rude",
      parts: null,
      reply: null,
      replied_at: null,
      created_at: "2026-09-01T00:00:00Z",
      released: true,
      hidden: false,
      hidden_reason: "",
      guide: { slug: "rami", display_name: "Rami" },
      author: "Omar",
    };
    const calls = route({
      "GET /api/v1/admin/guide-quality": [guide],
      "POST /api/v1/admin/guides/g1/strikes": { outcome: "warning", guides: [{ ...guide, active_strikes: 1 }] },
      "GET /api/v1/admin/guide-reviews": [review],
      "POST /api/v1/admin/guide-reviews/rv1": [{ ...review, hidden: true, hidden_reason: "Abusive" }],
    });
    const { container } = render(wrap(<GuideQualityAdmin />));
    expect(await screen.findByText("Trusted guide")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add strike" }));
    fireEvent.change(container.querySelector("#reason-g1") as HTMLElement, {
      target: { value: "Did not come (case checked)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Live strikes: 1/)).toBeTruthy();
    const strike = calls.find((call) => call.url.endsWith("/strikes"));
    expect(JSON.parse(String(strike?.init?.body))).toEqual({ kind: "no_show", reason: "Did not come (case checked)" });

    expect(await screen.findByText("Rude")).toBeTruthy();
    fireEvent.change(screen.getAllByPlaceholderText("Reason")[0] as HTMLElement, { target: { value: "Abusive" } });
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/guide-reviews/rv1"))).toBe(true));
    const hide = calls.find((call) => call.url.endsWith("/guide-reviews/rv1"));
    expect(JSON.parse(String(hide?.init?.body))).toEqual({ action: "hide", reason: "Abusive" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
