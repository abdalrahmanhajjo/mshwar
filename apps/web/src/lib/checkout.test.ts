import { describe, expect, it, vi } from "vitest";
import { commitCheckout, payCheckout, quoteCheckout } from "./checkout";

describe("checkout client", () => {
  it("posts a quote payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ effective_mode: "request", total_minor: 9000 }),
      })),
    );
    const quote = await quoteCheckout({
      listing_slug: "cedar-tasting",
      slot_id: "00000000-0000-0000-0000-000000000001",
      party_size: 2,
    });
    expect(quote.effective_mode).toBe("request");
    expect(quote.total_minor).toBe(9000);
    vi.unstubAllGlobals();
  });

  it("sends an idempotency key on commit and pay", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "booking-1", status: "pending" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await commitCheckout(
      {
        listing_slug: "cedar-tasting",
        slot_id: "00000000-0000-0000-0000-000000000001",
        party_size: 2,
        price_rule_id: "00000000-0000-0000-0000-000000000002",
        policy_id: "00000000-0000-0000-0000-000000000003",
        experience_id: "e",
        experience_title: "Cedar tasting",
        slug: "cedar-tasting",
        starts_at: "",
        ends_at: "",
        configured_mode: "request",
        effective_mode: "request",
        instant_eligible: false,
        currency: "USD",
        total_minor: 9000,
        payment_required: true,
        price_snapshot: {},
        policy_snapshot: {},
        remaining: 2,
      },
      "web-idem-01",
    );
    expect(JSON.stringify(fetchMock.mock.calls)).toContain("web-idem-01");
    await payCheckout("booking-1", "pay-idem-01");
    expect(JSON.stringify(fetchMock.mock.calls)).toContain("pay-idem-01");
    vi.unstubAllGlobals();
  });

  it("surfaces server validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        statusText: "Conflict",
        json: async () => ({ detail: "insufficient capacity" }),
      })),
    );
    await expect(
      quoteCheckout({
        listing_slug: "cedar-tasting",
        slot_id: "00000000-0000-0000-0000-000000000001",
        party_size: 2,
      }),
    ).rejects.toThrow("insufficient capacity");
    vi.unstubAllGlobals();
  });
});
