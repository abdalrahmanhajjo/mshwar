import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExchangeAdmin } from "./exchange-admin";
import { PartnerVerification } from "./partner-verification";
import { VenuesAdmin } from "./venues-admin";
import { TransportCardForm } from "@/components/transport/transport-card-form";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { adminTrustCopy } from "@/lib/admin-trust-copy";
import { parseRegister } from "@/lib/exchange";
import type { TransportCardInput } from "@/lib/transport";

const copy = adminTrustCopy.en;

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

function route(handlers: [string, unknown, number?][]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      const hit = handlers.find(([prefix]) => url.startsWith(prefix));
      return hit ? jsonResponse(hit[1], hit[2]) : jsonResponse({ detail: "not found" }, 404);
    }),
  );
  return calls;
}

const CASE = {
  id: "p1",
  kind: "driver",
  slug: "georges",
  display_name: "Georges",
  headline: "",
  bio: "",
  languages: [],
  regions: ["north"],
  live: false,
  trust: { level: "pending", checks: [], in_person: null, approved_on: null },
  photo_url: null,
  vehicles: [{ id: "v1", plate: "P 1", make: "Kia", model: "Rio", colour: "White", year: 2020, seats: 4, live: false }],
  status: "submitted",
  submitted_at: "2026-09-17T10:00:00Z",
  decided_at: null,
  decision_reason: "",
  trust_level: "pending",
  requirements: [],
  missing: [],
  agreement: { current: "2026-09-23", accepted: "2026-09-23" },
  security: { phone: "+96170000000", phone_verified: true, totp_enabled: true, totp_pending: false },
  documents: [
    {
      id: "doc1",
      kind: "public_licence",
      vehicle_id: null,
      reference: "PL-1",
      issuer: "Traffic authority",
      issued_on: "2025-01-01",
      expires_on: "2027-01-01",
      verification: "pending",
      reason: "",
      valid: false,
      lapses_on: null,
    },
  ],
  user_id: "u1",
  document_links: { doc1: "https://files.example/doc1" },
  events: [],
};

describe("partner verification", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens a case, links each document, and keeps approval shut until someone has met them", async () => {
    const calls = route([
      ["/api/v1/admin/partners/recheck-sample", []],
      [
        "/api/v1/admin/partners/documents/doc1",
        { ...CASE, documents: [{ ...CASE.documents[0], verification: "verified", valid: true }] },
      ],
      ["/api/v1/admin/partners/p1", CASE],
      [
        "/api/v1/admin/partners",
        [
          {
            id: "p1",
            kind: "driver",
            slug: "georges",
            display_name: "Georges",
            status: "submitted",
            trust_level: "pending",
            submitted_at: "2026-09-17T10:00:00Z",
            regions: [],
            pending_documents: 1,
            missing: [],
            waiting_hours: 26,
          },
        ],
      ],
    ]);
    render(wrap(<PartnerVerification />));
    fireEvent.click(await screen.findByRole("button", { name: /Georges/ }));
    expect(await screen.findByRole("link", { name: /Open document/ })).toHaveAttribute(
      "href",
      "https://files.example/doc1",
    );
    expect(screen.getByText(copy.approveBlocked)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.approve })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: copy.verifyDoc }));
    await waitFor(() =>
      expect(
        calls.some((call) => call.url === "/api/v1/admin/partners/documents/doc1" && call.init?.method === "POST"),
      ).toBe(true),
    );
  });
});

describe("the BDL register", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads pasted rows and reports the ones it cannot use", () => {
    const { entries, errors } = parseRegister(
      "Number,Category,Name\n123,B,Jbeil Exchange,Rue 1\n456\tA\tBeirut Change\nbad row",
    );
    expect(entries).toEqual([
      { bdl_number: "123", category: "B", name: "Jbeil Exchange", address: "Rue 1" },
      { bdl_number: "456", category: "A", name: "Beirut Change", address: "" },
    ]);
    expect(errors).toEqual([4]);
  });

  it("loads the month's list and shows who dropped off it", async () => {
    const calls = route([
      [
        "/api/v1/admin/exchange/register",
        {
          snapshot_id: "s1",
          entries: 1,
          matched: 1,
          missing: [{ partner_id: "p2", display_name: "Old Change", bdl_number: "999" }],
          category_changed: [],
        },
      ],
      ["/api/v1/admin/exchange", { latest: null, overdue: true, held_rates: [], licences: [] }],
    ]);
    render(wrap(<ExchangeAdmin />));
    expect(await screen.findByText(copy.registerNone)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(copy.sourceUrl), { target: { value: "https://www.bdl.gov.lb/list.pdf" } });
    fireEvent.change(screen.getByLabelText(copy.pasteLabel), { target: { value: "123,B,Jbeil Exchange" } });
    expect(screen.getByText("1 institutions read")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: copy.loadButton }));
    expect(await screen.findByText(/Old Change/)).toBeInTheDocument();
    const body = JSON.parse(String(calls.find((call) => call.url === "/api/v1/admin/exchange/register")?.init?.body));
    expect(body.entries).toEqual([{ bdl_number: "123", category: "B", name: "Jbeil Exchange", address: "" }]);
  });
});

describe("restaurants and stays", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows coverage against the targets", async () => {
    route([
      [
        "/api/v1/admin/coverage",
        {
          targets: { restaurants: 5, stays: 3 },
          destinations: [
            { slug: "byblos", name: "Byblos", restaurants: 2, stays: 3, transport_cards: 4, drivers: 1, changers: 0 },
          ],
        },
      ],
      ["/api/v1/admin/venues", { venues: [], claims: [] }],
      // The destination list is cached for the page, so every test here serves the same one.
      [
        "/api/v1/catalogue/destinations",
        [{ slug: "byblos", name: "Byblos", region: "Mount Lebanon", lat: 34.1, lng: 35.6 }],
      ],
    ]);
    render(wrap(<VenuesAdmin />));
    expect(await screen.findByText("2/5")).toBeInTheDocument();
    expect(screen.getByText("3/3")).toBeInTheDocument();
    expect(await screen.findByText(copy.noVenues)).toBeInTheDocument();
  });
});

describe("the transport card form", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("needs evidence, and sends fares in minor units", async () => {
    route([
      [
        "/api/v1/catalogue/destinations",
        [{ slug: "byblos", name: "Byblos", region: "Mount Lebanon", lat: 34.1, lng: 35.6 }],
      ],
    ]);
    const onSubmit = vi.fn(async (_input: TransportCardInput) => undefined);
    render(wrap(<TransportCardForm submitLabel="Save" evidenceKinds={["field_check"]} onSubmit={onSubmit} />));
    fireEvent.change(screen.getByLabelText(copy.scopeLabel), { target: { value: "around" } });
    await screen.findAllByRole("option", { name: "Byblos · Mount Lebanon" });
    fireEvent.change(screen.getByLabelText(copy.destinationLabel), { target: { value: "byblos" } });
    fireEvent.change(screen.getByLabelText(copy.fareLow), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText(copy.fareHigh), { target: { value: "2" } });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(copy.evidenceNote), {
      target: { value: "Rode it on 12 Sept, paid 150,000 LBP" },
    });
    fireEvent.click(screen.getByRole("button", { name: copy.addEvidence }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      scope: "around",
      from_destination: null,
      to_destination: "byblos",
      fare_low_minor: 150,
      fare_high_minor: 200,
      currency: "USD",
      evidence: [{ kind: "field_check", note: "Rode it on 12 Sept, paid 150,000 LBP", on: null }],
    });
  });
});
