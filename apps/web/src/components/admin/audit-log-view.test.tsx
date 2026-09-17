/// <reference types="vitest-axe/extend-expect" />
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AuditLogView, describeChanges } from "./audit-log-view";
import { LocaleProvider } from "@/components/shell/locale-provider";

const ENTRY = {
  id: "a1",
  created_at: "2026-09-16T10:00:00Z",
  action: "booking_force_cancel",
  target_type: "bookings",
  target_id: "b-123",
  target: { booking_id: "b-123" },
  organization_id: null,
  changes: { values: { status: { old: "confirmed", new: "cancelled" } }, fields: ["status", "notes"] },
  reason: "Guest asked support",
  request_id: "req-0123456789abcdef",
  actor: { kind: "admin", id: "11111111-2222-3333-4444-555555555555", display_name: "Rana" },
};

function mockFetch(pages: unknown[]) {
  const calls: string[] = [];
  const queue = [...pages];
  globalThis.fetch = vi.fn(async (url: string) => {
    calls.push(String(url));
    const body = String(url).includes("/audit/filters")
      ? { actions: ["booking_force_cancel"], target_types: ["bookings"] }
      : (queue.shift() ?? { items: [], next_cursor: null });
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

describe("audit log view", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("lists who did what, why, and which fields changed", async () => {
    mockFetch([{ items: [ENTRY], next_cursor: null }]);
    const { container } = render(
      <LocaleProvider>
        <AuditLogView />
      </LocaleProvider>,
    );
    const row = (await screen.findByText("booking_force_cancel")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Rana")).toBeInTheDocument();
    expect(within(row).getByText("Guest asked support")).toBeInTheDocument();
    expect(within(row).getByText('status: "confirmed" → "cancelled"')).toBeInTheDocument();
    expect(within(row).getByText("Fields changed: notes")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("applies filters, pages with the cursor and pivots on a request id", async () => {
    const calls = mockFetch([
      { items: [ENTRY], next_cursor: { before: "2026-09-16T10:00:00Z", before_id: "a1" } },
      { items: [ENTRY], next_cursor: { before: "2026-09-16T10:00:00Z", before_id: "a1" } },
      { items: [{ ...ENTRY, id: "a2" }], next_cursor: null },
      { items: [ENTRY], next_cursor: null },
    ]);
    render(
      <LocaleProvider>
        <AuditLogView />
      </LocaleProvider>,
    );
    await screen.findByText("booking_force_cancel");
    fireEvent.change(screen.getByLabelText("Action starts with"), { target: { value: "booking_" } });
    fireEvent.change(screen.getByLabelText("Record type"), { target: { value: "bookings" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(calls.some((url) => url.includes("action=booking_&target_type=bookings"))).toBe(true));

    fireEvent.click(await screen.findByRole("button", { name: "Load older entries" }));
    await waitFor(() => expect(calls.some((url) => url.includes("before_id=a1"))).toBe(true));
    await waitFor(() => expect(screen.getAllByText("booking_force_cancel")).toHaveLength(2));

    fireEvent.click(screen.getAllByRole("button", { name: "req-01234567" })[0]);
    await waitFor(() => expect(calls.at(-1)).toContain("request_id=req-0123456789abcdef"));
  });
});

describe("describeChanges", () => {
  it("handles explicit rows without a value map", () => {
    expect(describeChanges({ tier: "ops" })).toEqual({ values: ['tier: "ops"'], fields: [] });
  });
});
