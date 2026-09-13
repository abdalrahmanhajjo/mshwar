import { describe, expect, it, vi } from "vitest";
import { createOrganization, listOrganizations, publishExperience } from "./portal";

describe("portal client", () => {
  it("sends cookies and org header", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => [{ id: "org-1" }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("localStorage", {
      getItem: () => "org-1",
      setItem: () => undefined,
    });
    await listOrganizations();
    await createOrganization("Cedar");
    await publishExperience("org-1", "exp-1");
    expect(fetchMock).toHaveBeenCalled();
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const init = calls[0]?.[1] ?? {};
    const headers = new Headers(init.headers);
    expect(headers.get("x-organization-id")).toBe("org-1");
    expect(init).toMatchObject({ credentials: "include" });
    vi.unstubAllGlobals();
  });

  it("surfaces API detail errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ detail: "capability denied: listings" }),
      })),
    );
    await expect(listOrganizations()).rejects.toThrow("capability denied: listings");
    vi.unstubAllGlobals();
  });
});
