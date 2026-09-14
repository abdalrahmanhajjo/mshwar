import { describe, expect, it, vi } from "vitest";
import { adminCopy } from "./admin-copy";
import { isAdminTier, isElevatedTier, LIVE_SAFE_CONFIG_KEYS } from "./admin";
import { isAdminUser } from "./auth";

describe("admin helpers", () => {
  it("treats ops and elevated as admin and only elevated as financial", () => {
    expect(isAdminTier("ops")).toBe(true);
    expect(isAdminTier("elevated")).toBe(true);
    expect(isAdminTier(null)).toBe(false);
    expect(isElevatedTier("ops")).toBe(false);
    expect(isElevatedTier("elevated")).toBe(true);
    expect(isAdminUser({ id: "1", email: "a@b.c", display_name: "A", locale: "en", admin_tier: "ops" })).toBe(true);
    expect(isAdminUser({ id: "1", email: "a@b.c", display_name: "A", locale: "en" })).toBe(false);
  });

  it("keeps live-safe config keys documented", () => {
    expect(LIVE_SAFE_CONFIG_KEYS).toContain("marketplace.fees");
  });

  it("has the same admin copy keys in en, ar and fr", () => {
    const keys = Object.keys(adminCopy.en);
    expect(Object.keys(adminCopy.ar)).toEqual(keys);
    expect(Object.keys(adminCopy.fr)).toEqual(keys);
  });
});

describe("admin client errors", () => {
  it("surfaces API detail from verification calls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ detail: "admin role required" }),
      })),
    );
    const { listVerificationQueue } = await import("./admin");
    await expect(listVerificationQueue()).rejects.toThrow("admin role required");
    vi.unstubAllGlobals();
  });
});
