import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideApplication } from "./guide-application";
import { GuidePage } from "./guide-directory";
import { LocaleProvider } from "@/components/shell/locale-provider";
import type { MyGuideProfile, PublicGuide } from "@/lib/guides";

function wrap(ui: ReactNode) {
  return <LocaleProvider>{ui}</LocaleProvider>;
}

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body, headers: new Headers() };
}

const BASE: MyGuideProfile = {
  id: "g1",
  slug: "rami-haddad",
  tier: "licensed",
  badge: false,
  display_name: "Rami Haddad",
  headline: "Tripoli old city",
  bio: "",
  languages: ["ar", "en"],
  regions: ["north-lebanon"],
  specialities: [],
  years_guiding: 6,
  status: "draft",
  organization_id: null,
  phone: "",
  submitted_at: null,
  decided_at: null,
  decision_reason: "",
  required_documents: ["id", "licence"],
  documents: [],
};

describe("guide application", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names the documents still owed and keeps submit shut until they are there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(BASE)),
    );
    render(wrap(<GuideApplication />));

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getByText(/Still needed: ID, Guiding licence/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send for review/ })).toBeDisabled();
  });

  it("opens submit once every required document is attached", async () => {
    const complete: MyGuideProfile = {
      ...BASE,
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
        {
          id: "d2",
          kind: "licence",
          reference: "",
          issuer: "",
          issued_on: null,
          expires_on: "2030-01-01",
          verification: "pending",
          reason: "",
          expired: false,
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(complete)),
    );
    render(wrap(<GuideApplication />));

    await waitFor(() => expect(screen.getByRole("button", { name: /Send for review/ })).toBeEnabled());
    expect(screen.queryByText(/Still needed/)).not.toBeInTheDocument();
  });

  it("a local host owes only an ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ...BASE, tier: "host", required_documents: ["id"] })),
    );
    render(wrap(<GuideApplication />));
    expect(await screen.findByText(/Still needed: ID$/)).toBeInTheDocument();
  });

  it("says the licence lapsed rather than silently dropping the badge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ...BASE, status: "approved", badge: false, organization_id: "o1" })),
    );
    render(wrap(<GuideApplication />));
    expect(await screen.findByText("Licence expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View your page/ })).toBeInTheDocument();
  });

  it("locks the form once the application is with the reviewers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ ...BASE, status: "submitted" })),
    );
    render(wrap(<GuideApplication />));
    await screen.findByText("With our reviewers");
    expect(screen.getByRole("button", { name: /^Licensed guide/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Send for review/ })).not.toBeInTheDocument();
  });

  it("offers a first application when the account has none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(null)),
    );
    render(wrap(<GuideApplication />));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Save$/ })).toBeInTheDocument());
    // No profile yet, so there is nothing to attach documents to.
    expect(screen.queryByText("Documents")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name travellers will see"), { target: { value: "Nour" } });
    expect(screen.getByRole("button", { name: /^Save$/ })).toBeEnabled();
  });
});

describe("guide page", () => {
  it("shows the badge and never a document", () => {
    const guide: PublicGuide = {
      id: "g1",
      slug: "rami-haddad",
      tier: "licensed",
      badge: true,
      display_name: "Rami Haddad",
      headline: "Tripoli old city",
      bio: "Twenty years in the souks.",
      languages: ["ar", "en"],
      regions: ["north-lebanon"],
      specialities: ["history"],
      years_guiding: 20,
      status: "approved",
      organization_id: "o1",
    };
    render(wrap(<GuidePage guide={guide} />));
    expect(screen.getAllByText("Licensed guide").length).toBeGreaterThan(0);
    expect(screen.getByText("Twenty years in the souks.")).toBeInTheDocument();
    expect(screen.getByText("north-lebanon")).toBeInTheDocument();
    expect(screen.queryByText(/private\//)).not.toBeInTheDocument();
  });
});
