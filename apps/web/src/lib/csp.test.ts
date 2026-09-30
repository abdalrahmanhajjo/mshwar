import { describe, expect, it } from "vitest";
import { REPORTING_ENDPOINTS, contentSecurityPolicy, newNonce } from "./csp";

function directives(policy: string): Record<string, string> {
  return Object.fromEntries(
    policy.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values.join(" ")];
    }),
  );
}

describe("content security policy", () => {
  it("runs only nonced scripts and allows no inline script", () => {
    const policy = directives(contentSecurityPolicy({ nonce: "abc123" }));
    expect(policy["script-src"]).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(policy["script-src"]).not.toContain("unsafe-inline");
    expect(policy["object-src"]).toBe("'none'");
    expect(policy["frame-ancestors"]).toBe("'none'");
    expect(policy["report-uri"]).toBe("/api/v1/security/csp-report");
    expect(policy["report-to"]).toBe("csp");
    expect(REPORTING_ENDPOINTS).toBe('csp="/api/v1/security/csp-report"');
  });

  it("lists only the known image hosts", () => {
    const policy = directives(contentSecurityPolicy({ nonce: "n", imagekitUrl: "https://img.mshwarlb.com/abc/" }));
    expect(policy["img-src"].split(" ")).toEqual([
      "'self'",
      "data:",
      "blob:",
      "https://ik.imagekit.io",
      "https://upload.wikimedia.org",
      "https://images.unsplash.com",
      "https://img.mshwarlb.com",
    ]);
    expect(policy["img-src"]).not.toMatch(/https:(\s|$)/);
  });

  it("adds Sentry and development allowances only when asked", () => {
    const plain = directives(contentSecurityPolicy({ nonce: "n", sentryDsn: "not a url" }));
    expect(plain["connect-src"]).toBe("'self'");
    const full = directives(
      contentSecurityPolicy({ nonce: "n", development: true, sentryDsn: "https://key@o1.ingest.sentry.io/42" }),
    );
    expect(full["connect-src"]).toBe("'self' https://o1.ingest.sentry.io");
    expect(full["script-src"]).toContain("'unsafe-eval'");
  });

  it("makes a new unguessable nonce each time", () => {
    const nonces = new Set(Array.from({ length: 50 }, newNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
