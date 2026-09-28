import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const call = (points: string) =>
  GET(new NextRequest(`http://localhost/map-route?points=${encodeURIComponent(points)}`));

afterEach(() => vi.unstubAllGlobals());

describe("GET /map-route", () => {
  it("refuses anything but 2–25 points in and around Lebanon, without calling out", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("2.35,48.85;35.5,33.89");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ available: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the road route along real roads, cached for a day", async () => {
    const fetchMock = vi.fn(async (_url: string) =>
      Response.json({
        code: "Ok",
        routes: [
          {
            distance: 42_312.4,
            duration: 2_941.6,
            geometry: {
              type: "LineString",
              coordinates: [
                [35.5, 33.89],
                [35.64, 34.12],
              ],
            },
            legs: [{ distance: 42_312.4, duration: 2_941.6 }],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("35.5,33.89;35.64,34.12");
    expect(await response.json()).toEqual({
      available: true,
      coordinates: [
        [35.5, 33.89],
        [35.64, 34.12],
      ],
      distance_m: 42_312,
      duration_s: 2_942,
      legs: [{ distance_m: 42_312, duration_s: 2_942 }],
    });
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://router.project-osrm.org/route/v1/driving/35.5,33.89;35.64,34.12?overview=full&geometries=geojson&steps=false",
    );
  });

  it("says the route is unavailable when the routing server fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const response = await call("35.5,33.89;35.64,34.12");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ available: false });
  });
});
