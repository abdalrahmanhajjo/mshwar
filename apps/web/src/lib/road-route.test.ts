import { describe, expect, it } from "vitest";
import { googleDirectionsUrl, parseRoutePoints, routeQuery, wazeUrl } from "@/lib/road-route";

describe("Road routes", () => {
  it("accepts 2 to 25 points in and around Lebanon only", () => {
    expect(parseRoutePoints("35.5,33.89;35.64,34.12")).toEqual([
      [35.5, 33.89],
      [35.64, 34.12],
    ]);
    expect(parseRoutePoints(null)).toBeNull();
    expect(parseRoutePoints("35.5,33.89")).toBeNull(); // one point is not a route
    expect(parseRoutePoints("2.35,48.85;35.5,33.89")).toBeNull(); // Paris
    expect(parseRoutePoints("35.5,33.89;abc,34")).toBeNull();
    expect(parseRoutePoints("35.5,33.89,1;35.6,34")).toBeNull();
    expect(parseRoutePoints(Array.from({ length: 26 }, () => "35.5,33.89").join(";"))).toBeNull();
  });

  it("rounds to about a metre so the same day reuses its cached route", () => {
    expect(routeQuery([[35.500001234, 33.8912345]])).toBe("35.50000,33.89123");
  });

  it("hands the day to Google Maps for live traffic, from wherever the traveller is", () => {
    const url = new URL(
      googleDirectionsUrl([
        { lat: 34.12, lng: 35.64 },
        { lat: 34.25, lng: 35.66 },
        { lat: 34.24, lng: 36.01 },
      ]) ?? "",
    );
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("origin")).toBeNull();
    expect(url.searchParams.get("destination")).toBe("34.24,36.01");
    expect(url.searchParams.get("waypoints")).toBe("34.12,35.64|34.25,35.66");
    expect(url.searchParams.get("travelmode")).toBe("driving");
    expect(googleDirectionsUrl([])).toBeNull();
    expect(wazeUrl({ lat: 34.12, lng: 35.64 })).toBe("https://waze.com/ul?ll=34.12,35.64&navigate=yes");
  });

  it("never gives Google more than nine waypoints", () => {
    const stops = Array.from({ length: 14 }, (_, i) => ({ lat: 33.9 + i / 100, lng: 35.5 }));
    const url = new URL(googleDirectionsUrl(stops) ?? "");
    expect(url.searchParams.get("waypoints")?.split("|")).toHaveLength(9);
  });
});
