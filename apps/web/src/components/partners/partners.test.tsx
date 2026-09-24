import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChangerRates, rateProblem } from "./changer-rates";
import { DriverPortal } from "./driver-portal";
import { applicationBlockers } from "./submit-step";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { WhatWeChecked } from "@/components/verified/what-we-checked";
import { normalisePlate, type MyPartner } from "@/lib/partners";
import { partnerCopy } from "@/lib/partner-copy";
import { verifiedCopy } from "@/lib/verified-copy";

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

const PARTNER: MyPartner = {
  id: "p1",
  kind: "driver",
  slug: "georges",
  display_name: "Georges",
  headline: "",
  bio: "",
  languages: ["en"],
  regions: [],
  live: false,
  trust: { level: "none", checks: [], in_person: null, approved_on: null },
  photo_url: null,
  vehicles: [],
  status: "draft",
  submitted_at: null,
  decided_at: null,
  decision_reason: "",
  trust_level: "none",
  requirements: [],
  missing: [{ kind: "public_licence" }, { kind: "insurance", vehicle_id: "v1", plate: "P 1" }],
  agreement: { current: "2026-09-23", accepted: null },
  security: { phone: null, phone_verified: false, totp_enabled: false, totp_pending: false },
  documents: [],
};

describe("partner portals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists everything still blocking an application, in plain words", () => {
    const blockers = applicationBlockers("driver", PARTNER, partnerCopy.en, verifiedCopy.en);
    expect(blockers).toEqual([
      partnerCopy.en.needPhone,
      partnerCopy.en.needTotp,
      partnerCopy.en.needAreas,
      partnerCopy.en.needVehicle,
      expect.stringContaining(verifiedCopy.en.doc_public_licence),
      expect.stringContaining("(P 1)"),
      partnerCopy.en.needAgreement,
    ]);
  });

  it("introduces the driver programme before anything is filled in", async () => {
    route([["/api/v1/partners/me/driver", null]]);
    render(wrap(<DriverPortal />));
    expect(await screen.findByRole("button", { name: partnerCopy.en.start })).toBeInTheDocument();
    expect(screen.getByText(partnerCopy.en.driveNeed1)).toBeInTheDocument();
  });

  it("stores red plates in one form", () => {
    expect(normalisePlate(" p-123 456 ")).toBe("P 123456");
    expect(normalisePlate("b 12345")).toBe("B 12345");
  });

  it("shows what was checked with dates, never a bare tick", () => {
    render(
      wrap(
        <WhatWeChecked
          trust={{
            level: "verified",
            checks: [{ kind: "insurance", checked_on: "2026-09-01", valid_until: "2027-03-01", vehicle_plate: "P 1" }],
            in_person: { kind: "visit", on: "2026-09-03" },
            approved_on: "2026-09-03",
          }}
        />,
      ),
    );
    expect(screen.getByText(/P 1/)).toBeInTheDocument();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
  });
});

describe("changer rates", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("applies the same spread rule as the API", () => {
    expect(rateProblem(null, null)).toBe(false);
    expect(rateProblem(89000, null)).toBe(true);
    expect(rateProblem(90000, 89000)).toBe(true);
    expect(rateProblem(70000, 89500)).toBe(true);
    expect(rateProblem(89000, 89500)).toBe(false);
  });

  it("posts rates for a live branch with the authenticator step-up", async () => {
    const office = {
      id: "o1",
      branch_name: "Main street",
      address: "Jbeil",
      lat: 34.1,
      lng: 35.6,
      destination: { slug: "byblos", name: "Byblos" },
      hours: {},
      phone: "",
      checked_on: "2026-09-01",
      rates: [],
      changer: {} as never,
      active: true,
      verified: true,
      live: true,
      recent_rates: [],
    };
    const portal = {
      ...PARTNER,
      kind: "changer",
      status: "approved",
      licence: {
        bdl_number: "1",
        category: "B",
        legal_name: "X",
        register_status: "matched",
        matched_on: "2026-09-01",
        rates_suspended_until: null,
      },
      offices: [office],
    };
    let asked = 0;
    const calls: { url: string; body?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? String(init.body) : undefined });
        if (url === "/api/v1/exchange/me") return jsonResponse(portal);
        if (url === "/api/v1/partners/security/step-up") return jsonResponse({ valid_until: "2026-09-18T12:10:00Z" });
        if (url === "/api/v1/exchange/me/rates") {
          asked += 1;
          return asked === 1
            ? jsonResponse({ detail: "step-up required: enter a code from your authenticator app" }, 422)
            : jsonResponse({
                ...portal,
                offices: [
                  {
                    ...office,
                    recent_rates: [
                      {
                        id: "r1",
                        base: "USD",
                        buy: 89000,
                        sell: 89500,
                        posted_at: "2026-09-18T12:00:00Z",
                        status: "live",
                        held_reason: "",
                      },
                    ],
                  },
                ],
              });
        }
        return jsonResponse({ detail: "not found" }, 404);
      }),
    );
    render(wrap(<ChangerRates />));
    fireEvent.change(await screen.findByLabelText("We buy 1 USD for (LBP)"), { target: { value: "89,000" } });
    fireEvent.change(screen.getByLabelText("We sell 1 USD for (LBP)"), { target: { value: "89500" } });
    fireEvent.click(screen.getByRole("button", { name: partnerCopy.en.postRates }));
    const code = await screen.findByLabelText(verifiedCopy.en.codeLabel);
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: verifiedCopy.en.stepUpAction }));
    expect(await screen.findByText(partnerCopy.en.rate_live)).toBeInTheDocument();
    const posted = calls.filter((call) => call.url === "/api/v1/exchange/me/rates");
    expect(posted).toHaveLength(2);
    expect(JSON.parse(posted[1]?.body ?? "{}")).toEqual({
      office_id: "o1",
      rates: [{ base: "USD", buy: 89000, sell: 89500 }],
    });
  });

  it("says rates wait for a checked branch and an approved account", async () => {
    route([["/api/v1/exchange/me", null]]);
    render(wrap(<ChangerRates />));
    await waitFor(() => expect(screen.getByText(partnerCopy.en.ratesNotLive)).toBeInTheDocument());
  });
});
