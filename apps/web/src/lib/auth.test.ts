import { describe, expect, it } from "vitest";
import { isProtectedPath, safeNextPath } from "./auth";

describe("auth helpers", () => {
  it("marks traveller account routes and portals as protected", () => {
    expect(isProtectedPath("/plan")).toBe(true);
    expect(isProtectedPath("/saved/list")).toBe(true);
    expect(isProtectedPath("/bookings")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/business/listings")).toBe(true);
    expect(isProtectedPath("/admin/users")).toBe(true);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/signin")).toBe(false);
    expect(isProtectedPath("/forgot-password")).toBe(false);
    expect(isProtectedPath("/reset-password")).toBe(false);
    expect(isProtectedPath("/verify-email")).toBe(false);
    expect(isProtectedPath("/privacy")).toBe(false);
    expect(isProtectedPath("/ar/plan")).toBe(true);
    expect(isProtectedPath("/fr/settings")).toBe(true);
    expect(isProtectedPath("/ar")).toBe(false);
  });

  it("rejects open redirects in the next param", () => {
    expect(safeNextPath("/saved")).toBe("/saved");
    expect(safeNextPath("/plan?x=1")).toBe("/plan?x=1");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
