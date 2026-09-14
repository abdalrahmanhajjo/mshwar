import { afterEach, describe, expect, it, vi } from "vitest";
import { COOKIE_CONSENT_KEY, POLICY_VERSION, analyticsAllowed, readCookieConsent, saveCookieConsent, securityFetch, sentryBeforeSend } from "./security";
import { policies } from "./legal-copy";

afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });
describe("privacy and telemetry", () => {
  it("defaults to essential only, supports opt-in and withdrawal", () => {
    expect(analyticsAllowed()).toBe(false);
    saveCookieConsent(true); expect(analyticsAllowed()).toBe(true);
    saveCookieConsent(false); expect(analyticsAllowed()).toBe(false);
    localStorage.setItem(COOKIE_CONSENT_KEY, "broken"); expect(readCookieConsent().analytics).toBe(false);
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ version: "old", analytics: true })); expect(analyticsAllowed()).toBe(false);
    expect(readCookieConsent().version).toBe(POLICY_VERSION);
  });
  it("sends an opaque correlation ID with API requests", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true }); vi.stubGlobal("fetch", fetch);
    await securityFetch("/api/v1/privacy/consents", { headers: { "Content-Type": "application/json" } });
    const headers = fetch.mock.calls[0][1].headers as Headers;
    expect(headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers.get("Content-Type")).toBe("application/json");
  });
  it("scrubs Sentry payloads before sending", () => {
    const result = JSON.stringify(sentryBeforeSend({ user: { email: "private" }, request: { data: "private" }, extra: { token: "private" }, message: "Bearer opaque", tags: { payment_id: "private" } }));
    expect(result).not.toContain("private"); expect(result).not.toContain("opaque");
  });
  it("publishes all four complete policies in all locales", () => {
    for (const locale of ["en", "ar", "fr"] as const) {
      expect(Object.keys(policies[locale])).toEqual(["privacy", "terms", "cancellation", "community"]);
      for (const policy of Object.values(policies[locale])) {
        expect(policy.sections.length).toBeGreaterThanOrEqual(3);
        for (const section of policy.sections) expect(section.body.length).toBeGreaterThan(100);
      }
    }
  });
});
