import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "./dashboard-view";
import { PortalProvider } from "./portal-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

function renderDashboard() {
  return render(
    <LocaleProvider>
      <PortalProvider>
        <DashboardView />
      </PortalProvider>
    </LocaleProvider>,
  );
}

describe("dashboard view", () => {
  it("registers an organisation from the empty state", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/portal/organizations") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            id: "org-1",
            name: "Cedar",
            slug: "cedar",
            status: "active",
            verification: "pending",
            role: "owner",
            public_contact: {},
            onboarding: {
              verification: "pending",
              can_publish: false,
              items: [{ key: "org_profile", done: true }],
            },
          }),
        };
      }
      if (String(url).includes("/portal/organizations") && String(url).includes("/metrics")) {
        return {
          ok: true,
          json: async () => ({
            current: { views: 2, saves: 0, itinerary_inclusions: 0, requests: 1, confirmations: 0, revenue_minor: 0 },
            previous: { views: 1, saves: 0, itinerary_inclusions: 0, requests: 0, confirmations: 0, revenue_minor: 0 },
            comparison_from: "a",
            comparison_to: "b",
          }),
        };
      }
      if (String(url).endsWith("/portal/organizations")) {
        return { ok: true, json: async () => [] };
      }
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    renderDashboard();
    await waitFor(() => expect(screen.getByLabelText("Organisation name")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Organisation name"), { target: { value: "Cedar Kitchen" } });
    fireEvent.click(screen.getByRole("button", { name: "Create organisation" }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((call) => String(call[0]).includes("/organizations") && call[1]?.method === "POST"),
      ).toBe(true),
    );
    vi.unstubAllGlobals();
  });
});
