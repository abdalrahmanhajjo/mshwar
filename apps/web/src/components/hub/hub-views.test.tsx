import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingsView } from "./bookings-view";
import { FavoritesView } from "./favorites-view";
import { NotificationsView } from "./notifications-view";
import { TripsView } from "./trips-view";
import { AuthProvider } from "@/components/shell/auth-provider";
import { LocaleProvider } from "@/components/shell/locale-provider";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function wrap(ui: ReactNode) {
  return (
    <LocaleProvider>
      <AuthProvider>{ui}</AuthProvider>
    </LocaleProvider>
  );
}

describe("account hub views", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a trip empty state that links to plan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/auth/me")) {
          return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
        }
        return jsonResponse({ items: [], page: 1, page_size: 6, total: 0 });
      }),
    );
    render(wrap(<TripsView />));
    expect(await screen.findByRole("heading", { name: "Your trips" })).toBeInTheDocument();
    expect(screen.getByText("No trips yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan a trip" })).toHaveAttribute("href", "/plan");
  });

  it("archives a trip from the list", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      if (String(url).includes("/archive") && init?.method === "POST") {
        return jsonResponse({
          id: "trip-1",
          name: "Coast",
          status: "archived",
          created_at: "2026-09-01T00:00:00Z",
        });
      }
      return jsonResponse({
        items: [{ id: "trip-1", name: "Coast", status: "draft", created_at: "2026-09-01T00:00:00Z" }],
        page: 1,
        page_size: 6,
        total: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(wrap(<TripsView />));
    expect(await screen.findByText("Coast")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Archive trip" }));
    await waitFor(() => expect(screen.getByText("Archived")).toBeInTheDocument());
  });

  it("shows favorites empty state and unfavorites a card", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      if (init?.method === "DELETE") {
        return { ok: true, status: 204, json: async () => ({}) };
      }
      return jsonResponse({
        items: [{ id: "fav-1", listing_slug: "slow-day-byblos", created_at: "2026-09-01T00:00:00Z" }],
        page: 1,
        page_size: 6,
        total: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(wrap(<FavoritesView />));
    expect(await screen.findByRole("heading", { name: "Favorites" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove favorite" }));
    await waitFor(() => expect(fetchMock.mock.calls.some((call) => call[1]?.method === "DELETE")).toBe(true));
  });

  it("cancels a booking with a reason and never offers a silent delete", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({
          id: "1",
          email: "a@b.com",
          display_name: "Ada",
          locale: "en",
          email_verified: true,
        });
      }
      if (String(url).includes("/cancel")) {
        return jsonResponse({
          id: "book-1",
          listing_slug: "slow-day-byblos",
          business_id: 3,
          status: "cancelled",
          policy_summary: "Preview booking. Cancel requires a reason.",
          reason: "Weather",
          created_at: "2026-09-01T00:00:00Z",
        });
      }
      return jsonResponse({
        items: [
          {
            id: "book-1",
            listing_slug: "slow-day-byblos",
            business_id: 3,
            status: "confirmed",
            policy_summary: "Preview booking. Cancel requires a reason.",
            reason: null,
            created_at: "2026-09-01T00:00:00Z",
          },
        ],
        page: 1,
        page_size: 6,
        total: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(wrap(<BookingsView />));
    expect(await screen.findByText("Preview booking. Cancel requires a reason.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Why are you cancelling?"), { target: { value: "Weather" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel this booking" }));
    await waitFor(() => expect(screen.getByText("Cancelled")).toBeInTheDocument());
  });

  it("marks a notification read", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/auth/me")) {
        return jsonResponse({ id: "1", email: "a@b.com", display_name: "Ada", locale: "en" });
      }
      if (String(url).includes("/read") && init?.method === "POST") {
        return jsonResponse({
          id: "note-1",
          title: "Booking cancelled",
          body: "Kept on your account.",
          category: "transactional",
          read_at: "2026-09-01T01:00:00Z",
          created_at: "2026-09-01T00:00:00Z",
        });
      }
      return jsonResponse({
        items: [
          {
            id: "note-1",
            title: "Booking cancelled",
            body: "Kept on your account.",
            category: "transactional",
            read_at: null,
            created_at: "2026-09-01T00:00:00Z",
          },
        ],
        page: 1,
        page_size: 6,
        total: 1,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(wrap(<NotificationsView />));
    expect(await screen.findByText("Unread")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark as read" }));
    await waitFor(() => expect(screen.getByText("Read")).toBeInTheDocument());
  });
});
