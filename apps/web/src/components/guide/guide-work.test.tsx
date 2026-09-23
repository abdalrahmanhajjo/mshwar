import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalisePattern } from "./guide-calendar";
import { summarise } from "./guide-home";
import { GuideProvider } from "./guide-provider";
import { PublicTours } from "./public-tours";
import { RequestInbox } from "./request-inbox";
import { TourBuilder, toTourInput } from "./tour-builder";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { GuideRequest, PublicTour } from "@/lib/guide-work";
import type { MyGuideProfile, PublicGuide } from "@/lib/guides";

vi.mock("@/components/shell/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1", display_name: "Maya" }, ready: true, auth: { status: "signed-in" } }),
}));

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

const GUIDE: MyGuideProfile = {
  id: "g1",
  slug: "rami-haddad",
  tier: "licensed",
  badge: true,
  display_name: "Rami Haddad",
  headline: "",
  bio: "",
  languages: ["ar", "en"],
  regions: ["beirut"],
  specialities: [],
  years_guiding: null,
  status: "approved",
  organization_id: "org-1",
  phone: "",
  submitted_at: null,
  decided_at: null,
  decision_reason: "",
  required_documents: ["id", "licence"],
  documents: [],
};

const REQUEST: GuideRequest = {
  id: "b1",
  status: "pending",
  party_size: 3,
  traveller_note: "",
  experience_id: "t1",
  experience_title: "Hamra on foot",
  starts_at: "2099-05-02T07:00:00Z",
  ends_at: "2099-05-02T09:00:00Z",
  capacity: 8,
  reserved: 3,
  remaining: 5,
  total_minor: 7500,
  currency: "USD",
};

function route(handlers: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const key = Object.keys(handlers).find((prefix) => url.startsWith(prefix));
      return key ? jsonResponse(handlers[key]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

describe("guide tours and requests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("never sends a price for a local host, whatever the field held", () => {
    const draft = {
      title: " Walk ",
      description: "A long enough description",
      duration: "90",
      maxParty: "6",
      minAge: "",
      price: "25",
      unit: "person" as const,
      languages: "ar, en",
      included: "",
      bring: "",
      cancellation: "",
      meetingName: "Square",
      meetingAddress: "",
      lat: "33.9",
      lng: "35.5",
      destination: "beirut",
      route: ["byblos-citadel"],
    };
    expect(toTourInput(draft, "host").price_minor).toBe(0);
    expect(toTourInput(draft, "licensed").price_minor).toBe(2500);
    expect(toTourInput(draft, "licensed").languages).toEqual(["ar", "en"]);
    expect(toTourInput(draft, "licensed").title).toBe("Walk");
  });

  it("sorts and de-duplicates the weekly pattern", () => {
    expect(
      normalisePattern([
        { weekday: 2, start: "17:00" },
        { weekday: 0, start: "10:00" },
        { weekday: 2, start: "09:00" },
        { weekday: 0, start: "10:00" },
        { weekday: 1, start: "25:00" },
      ]),
    ).toEqual([
      { weekday: 0, start: "10:00" },
      { weekday: 2, start: "09:00" },
      { weekday: 2, start: "17:00" },
    ]);
  });

  it("counts only future requests on the home screen", () => {
    const past = { ...REQUEST, id: "b0", starts_at: "2000-01-01T00:00:00Z" };
    const confirmed = { ...REQUEST, id: "b2", status: "confirmed" };
    const summary = summarise([past, REQUEST, confirmed], [], new Date("2026-01-01"));
    expect(summary.pending.map((row) => row.id)).toEqual(["b1"]);
    expect(summary.confirmed.map((row) => row.id)).toEqual(["b2"]);
  });

  it("sends an unapproved guide back to their application", async () => {
    route({ "/api/v1/guides/me": { ...GUIDE, status: "submitted", organization_id: null } });
    render(
      wrap(
        <GuideProvider>
          <TourBuilder />
        </GuideProvider>,
      ),
    );
    expect(await screen.findByText("Your guide page isn’t live yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your application" })).toHaveAttribute("href", "/guide");
  });

  it("shows a host that their tours are free and hides the price field", async () => {
    route({ "/api/v1/guides/me/tours": [], "/api/v1/guides/me": { ...GUIDE, tier: "host", badge: false } });
    render(
      wrap(
        <GuideProvider>
          <TourBuilder />
        </GuideProvider>,
      ),
    );
    fireEvent.click(await screen.findByRole("button", { name: /New tour/ }));
    expect(screen.getByText(/Local hosts run free walks/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Price (USD)")).not.toBeInTheDocument();
  });

  it("confirms a request with the guide's note and says what to collect", async () => {
    const calls = route({
      "/api/v1/guides/me/requests/b1/respond": { ...REQUEST, status: "confirmed" },
      "/api/v1/guides/me/requests": [REQUEST],
      "/api/v1/guides/me": GUIDE,
    });
    render(
      wrap(
        <GuideProvider>
          <RequestInbox />
        </GuideProvider>,
      ),
    );
    expect(await screen.findByText("Hamra on foot")).toBeInTheDocument();
    expect(screen.getByText(/Collect \$75\.00 on the day/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Note to the traveller"), { target: { value: "Meet by the fountain" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/respond"))).toBe(true));
    const sent = calls.find((call) => call.url.endsWith("/respond"));
    expect(JSON.parse(String(sent?.init?.body))).toMatchObject({ status: "confirmed", reason: "Meet by the fountain" });
  });

  it("asks for a tour date with an idempotency key and promises payment on the day", async () => {
    const calls = route({
      "/api/v1/guides/tours/hamra-on-foot/request": { id: "b9", status: "pending", payment_required: false },
    });
    const tour: PublicTour = {
      slug: "hamra-on-foot",
      title: "Hamra on foot",
      description: "Bookshops and cinemas.",
      duration_minutes: 120,
      max_party: 8,
      min_age: null,
      intensity: null,
      languages: ["en"],
      meeting_point: "By the Costa",
      included: "",
      bring: "Shoes",
      cancellation_terms: "",
      price_minor: 2500,
      price_unit: "person",
      route: [],
      next_slots: [{ id: "s1", starts_at: "2099-05-02T07:00:00Z", remaining: 8 }],
    };
    const guide = GUIDE as unknown as PublicGuide;
    render(wrap(<PublicTours guide={guide} tours={[tour]} />));
    expect(screen.getByText("Pay the guide on the day")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Ask for this date/ }));
    expect(await screen.findByText(/Request sent\. Rami Haddad will confirm/)).toBeInTheDocument();
    const sent = calls[0];
    expect(new Headers(sent?.init?.headers).get("Idempotency-Key")).toMatch(/^tour-/);
    expect(JSON.parse(String(sent?.init?.body))).toEqual({ slot_id: "s1", party_size: 2 });
  });
});
