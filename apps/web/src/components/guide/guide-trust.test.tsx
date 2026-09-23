import fs from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stepRate } from "@/components/admin/guide-funnel";
import { GuideApplication } from "./guide-application";
import { filterHelp } from "./guide-help";
import { ReportProblem } from "./report-problem";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { GUIDE_HELP } from "@/lib/guide-help";
import type { MyGuideProfile } from "@/lib/guides";
import { GUIDE_AGREEMENT, GUIDE_AGREEMENT_VERSION } from "@/lib/legal/guide-agreement";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body, headers: new Headers(), statusText: "" };
}

const DRAFT: MyGuideProfile = {
  id: "g1",
  slug: "nour",
  tier: "host",
  badge: false,
  display_name: "Nour",
  headline: "",
  bio: "",
  languages: ["ar"],
  regions: ["beirut"],
  specialities: [],
  years_guiding: null,
  status: "draft",
  organization_id: null,
  phone: "",
  submitted_at: null,
  decided_at: null,
  decision_reason: "",
  required_documents: ["id"],
  documents: [
    {
      id: "d1",
      kind: "id",
      reference: "",
      issuer: "",
      issued_on: null,
      expires_on: null,
      verification: "pending",
      reason: "",
      expired: false,
    },
  ],
  agreement: { current: GUIDE_AGREEMENT_VERSION, accepted: null },
};

describe("trust and safety for guides", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the agreement version in step with the database and every language in step with English", () => {
    const migration = fs.readFileSync(
      path.resolve(__dirname, "../../../../../mshwar-database/migrations/038_guide_trust.sql"),
      "utf8",
    );
    expect(migration).toContain(`SELECT '${GUIDE_AGREEMENT_VERSION}'::text`);
    const outline = (locale: "en" | "ar" | "fr") =>
      GUIDE_AGREEMENT[locale].sections.map(
        (section) => `${section.id}:${section.body.map((b) => (typeof b === "string" ? "p" : b.list.length)).join()}`,
      );
    expect(outline("ar")).toEqual(outline("en"));
    expect(outline("fr")).toEqual(outline("en"));
  });

  it("holds the application until the agreement is accepted", async () => {
    const calls: { url: string; body?: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? String(init.body) : undefined });
        if (url.endsWith("/agreement")) {
          return jsonResponse({
            ...DRAFT,
            agreement: { current: GUIDE_AGREEMENT_VERSION, accepted: GUIDE_AGREEMENT_VERSION },
          });
        }
        return jsonResponse(DRAFT);
      }),
    );
    render(wrap(<GuideApplication />));
    const submit = await screen.findByRole("button", { name: /Send for review/ });
    expect(submit).toBeDisabled();
    expect(screen.getByText("Accept the agreement to send your application.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /I have read and accept/ }));
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText(`Accepted (version ${GUIDE_AGREEMENT_VERSION}).`)).toBeInTheDocument();
    expect(JSON.parse(calls.find((call) => call.url.endsWith("/agreement"))?.body ?? "{}")).toEqual({
      version: GUIDE_AGREEMENT_VERSION,
    });
    expect(screen.getByRole("button", { name: /Send for review/ })).toBeEnabled();
  });

  it("sends a safety report and says a person will see it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ id: "c1", category: "safety", escalated: true })),
    );
    render(wrap(<ReportProblem engagementId="e1" />));
    fireEvent.click(screen.getByRole("button", { name: /Report a problem/ }));
    fireEvent.change(screen.getByLabelText("Kind of problem"), { target: { value: "safety" } });
    fireEvent.change(screen.getByLabelText("What happened"), {
      target: { value: "Drove far too fast on the coast road" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send report/ }));
    expect(await screen.findByText(/Safety reports go straight to a person/)).toBeInTheDocument();
  });

  it("searches the help centre by every word typed", () => {
    const found = filterHelp(GUIDE_HELP.en.sections, "paid day");
    expect(found.flatMap((section) => section.entries.map((entry) => entry.id))).toContain("payment");
    expect(filterHelp(GUIDE_HELP.en.sections, "zzzz")).toEqual([]);
    expect(GUIDE_HELP.ar.sections.map((s) => s.entries.length)).toEqual(
      GUIDE_HELP.en.sections.map((s) => s.entries.length),
    );
  });

  it("computes each funnel step against the one before", () => {
    expect(stepRate(3, 12)).toBe(25);
    expect(stepRate(1, 0)).toBeNull();
  });
});
