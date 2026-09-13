import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BookingInbox } from "./booking-inbox";
import { PortalProvider } from "./portal-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

describe("booking inbox", () => {
  it("confirms a request with a reason", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/portal/organizations") && !String(url).includes("/bookings")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "org-1",
              name: "Cedar",
              slug: "cedar",
              status: "active",
              verification: "verified",
              role: "owner",
              public_contact: {},
              onboarding: { verification: "verified", can_publish: true, items: [] },
            },
          ],
        };
      }
      if (String(url).includes("/bookings") && !String(url).includes("/respond")) {
        return {
          ok: true,
          json: async () => [
            {
              id: "b1",
              status: "pending",
              party_size: 2,
              traveller_note: "Window please",
              experience_id: "e1",
              experience_title: "Cedar tasting",
              starts_at: "2026-09-20T10:00:00Z",
              ends_at: "2026-09-20T12:00:00Z",
              capacity: 10,
              reserved: 2,
              remaining: 8,
              total_minor: 9000,
              currency: "USD",
            },
          ],
        };
      }
      if (String(url).includes("/respond")) {
        return { ok: true, json: async () => ({ id: "b1", status: "confirmed" }) };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <LocaleProvider>
        <PortalProvider>
          <BookingInbox />
        </PortalProvider>
      </LocaleProvider>,
    );
    await waitFor(() => expect(screen.getByText(/Cedar tasting/)).toBeInTheDocument());
    expect(screen.getByText(/Window please/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/respond"))).toBe(true));
    expect(initBody(fetchMock)).toContain("Confirmed from inbox");
    vi.unstubAllGlobals();
  });
});

function initBody(fetchMock: ReturnType<typeof vi.fn>): string {
  const call = fetchMock.mock.calls.find((item) => String(item[0]).includes("/respond"));
  return String(call?.[1] && typeof call[1] === "object" && "body" in call[1] ? call[1].body : "");
}
