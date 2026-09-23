import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GuideContribute } from "./contribute";
import { GuideProvider } from "./guide-provider";
import { PlaceCredit } from "./place-credit";
import { ProposalQueue } from "@/components/admin/proposal-queue";
import { LocaleProvider } from "@/components/shell/locale-provider";
import { compactPlace, type QueuedProposal } from "@/lib/guide-contribute";

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

const GUIDE = { id: "g1", slug: "rami", tier: "host", status: "approved", organization_id: "o1", display_name: "Rami" };

const QUEUED: QueuedProposal = {
  id: "p1",
  kind: "correction",
  status: "submitted",
  payload: { address: "Next to the old well" },
  evidence_urls: ["https://example.org/news"],
  reason: "",
  created_at: "2026-09-01T00:00:00Z",
  reviewed_at: null,
  target: { id: "e1", slug: "harbour", title: "Harbour", description: "", address: "Port road", lat: 34.1, lng: 35.6 },
  resulting_slug: null,
  photos: [],
  guide: { id: "g1", slug: "rami", display_name: "Rami", tier: "host" },
  allowance: { accepted: 3, rejected: 1, used: 0, daily_cap: 8, remaining: 8 },
};

describe("place proposals", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("drops empty fields so a correction carries only what changed", () => {
    expect(compactPlace({ title: "", address: "New road", lat: Number.NaN, closed: undefined })).toEqual({
      address: "New road",
    });
  });

  it("sends a new place with its sources and shows today's allowance", async () => {
    const calls = route([
      [
        "/api/v1/guides/me/proposals",
        { allowance: { accepted: 0, rejected: 0, used: 0, daily_cap: 2, remaining: 2 }, proposals: [] },
      ],
      ["/api/v1/guides/me", GUIDE],
    ]);
    render(
      wrap(
        <GuideProvider>
          <GuideContribute />
        </GuideProvider>,
      ),
    );
    expect(await screen.findByText(/2 of 2 proposals left today/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Hidden chapel" } });
    fireEvent.change(screen.getByLabelText("What it is and why people go"), {
      target: { value: "A stone chapel above the valley, open most mornings." },
    });
    fireEvent.change(screen.getByLabelText("Latitude"), { target: { value: "34.12" } });
    fireEvent.change(screen.getByLabelText("Longitude"), { target: { value: "35.66" } });
    fireEvent.change(screen.getByLabelText("Sources that show this is right 1"), {
      target: { value: "https://example.org/chapel" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send for review/ }));
    await waitFor(() => expect(calls.some((call) => call.init?.method === "POST")).toBe(true));
    const sent = JSON.parse(String(calls.find((call) => call.init?.method === "POST")?.init?.body));
    expect(sent).toMatchObject({
      kind: "new",
      evidence_urls: ["https://example.org/chapel"],
      place: { name: "Hidden chapel", lat: 34.12, lng: 35.66, category: "heritage" },
    });
  });

  it("credits the guide who added a place", () => {
    render(
      wrap(
        <PlaceCredit
          contributors={[{ role: "added", slug: "rami", display_name: "Rami", tier: "host", at: "2026-09-01" }]}
        />,
      ),
    );
    expect(screen.getByText(/Added by/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Rami" })).toHaveAttribute("href", "/guides/rami");
  });

  it("shows a correction beside the current value and needs a reason to reject", async () => {
    const calls = route([
      ["/api/v1/admin/proposals/p1", { ...QUEUED, status: "accepted" }],
      ["/api/v1/admin/proposals", [QUEUED]],
    ]);
    render(wrap(<ProposalQueue />));
    expect(await screen.findByText("Next to the old well")).toBeInTheDocument();
    expect(screen.getByText("Port road")).toBeInTheDocument();
    expect(screen.getByText(/3 accepted, 1 not/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    await waitFor(() => expect(calls.some((call) => call.url.endsWith("/p1"))).toBe(true));
  });
});
