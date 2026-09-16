import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function request(path: string, cookie?: string, session?: string) {
  const headers = new Headers();
  const parts = [cookie ? `mshwar-locale=${cookie}` : null, session ? `mshwar_session=${session}` : null].filter(
    Boolean,
  );
  if (parts.length > 0) {
    headers.set("cookie", parts.join("; "));
  }
  return new NextRequest(new URL(path, "http://127.0.0.1:3001"), { headers });
}

function rewriteTarget(response: Response) {
  return response.headers.get("x-middleware-rewrite") ?? "";
}

function location(response: Response) {
  return response.headers.get("location") ?? "";
}

describe("locale proxy", () => {
  it("rewrites a prefixed Arabic path and stores the guest cookie", () => {
    const response = proxy(request("/ar/destinations"));
    expect(rewriteTarget(response)).toContain("/destinations");
    expect(response.cookies.get("mshwar-locale")?.value).toBe("ar");
  });

  it("keeps an unprefixed path on the cookie locale so guests persist without a prefix", () => {
    const response = proxy(request("/destinations", "ar"));
    expect(rewriteTarget(response)).toBe("");
    expect(response.cookies.get("mshwar-locale")?.value).toBe("ar");
  });

  it("sends unauthenticated locale-prefixed plan visits to locale-prefixed sign-in", () => {
    const response = proxy(request("/ar/plan"));
    expect(location(response)).toContain("/ar/signin");
    expect(location(response)).toContain("next=%2Far%2Fplan");
  });

  it("lets a signed-in visitor through a protected prefixed path", () => {
    const response = proxy(request("/fr/settings", "fr", "session-token"));
    expect(location(response)).toBe("");
    expect(rewriteTarget(response)).toContain("/settings");
    expect(response.cookies.get("mshwar-locale")?.value).toBe("fr");
  });
});
