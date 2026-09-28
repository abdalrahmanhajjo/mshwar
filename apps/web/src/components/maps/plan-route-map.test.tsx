import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlanRouteMap } from "./plan-route-map";
import { plannerCopy } from "@/lib/planner-copy";

const copy = plannerCopy.en;

// A stand-in for MapLibre (jsdom has no WebGL): it records what the plan map draws.
const drawn = vi.hoisted(() => ({ markers: [] as [number, number][], route: null as unknown, dash: null as unknown }));
vi.mock("@/lib/maplibre", async (original) => {
  const actual = await original<typeof import("@/lib/maplibre")>();
  class Marker {
    private at: [number, number] = [0, 0];
    setLngLat(at: [number, number]) {
      this.at = at;
      return this;
    }
    addTo() {
      drawn.markers.push(this.at);
      return this;
    }
    remove() {}
  }
  return {
    ...actual,
    createLebanonMap: async () => {
      const handlers: Record<string, () => void> = {};
      const sources: Record<string, { setData: (data: unknown) => void }> = {};
      const map = {
        on: (event: string, handler: () => void) => {
          handlers[event] = handler;
          if (event === "load") queueMicrotask(handler);
        },
        addSource: (id: string) => {
          sources[id] = { setData: (data) => (drawn.route = data) };
        },
        addLayer: () => undefined,
        getSource: (id: string) => sources[id],
        setPaintProperty: (_layer: string, _key: string, value: unknown) => (drawn.dash = value),
        fitBounds: () => undefined,
        easeTo: () => undefined,
        remove: () => undefined,
      };
      return { map, lib: { Marker } };
    },
  };
});

const STOPS = [
  { key: "1", lat: 34.123, lng: 35.648, label: "Byblos citadel" },
  { key: "2", lat: 34.255, lng: 35.658, label: "Batroun old souk" },
];

afterEach(() => {
  drawn.markers = [];
  drawn.route = null;
  vi.unstubAllGlobals();
});

describe("The plan map", () => {
  it("draws the start and numbered stops, the road route, and its typical drive time", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        available: true,
        coordinates: [
          [35.5, 33.9],
          [35.648, 34.123],
          [35.658, 34.255],
        ],
        distance_m: 42_300,
        duration_s: 2_940,
        legs: [],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<PlanRouteMap stops={STOPS} start={{ lat: 33.9, lng: 35.5 }} day={1} copy={copy} />);

    expect(screen.getByRole("region", { name: "Map of day 1" })).toBeInTheDocument();
    await screen.findByText("42.3 km · about 49 min by car, without traffic");
    expect(fetchMock).toHaveBeenCalledWith(
      `/map-route?points=${encodeURIComponent("35.50000,33.90000;35.64800,34.12300;35.65800,34.25500")}`,
      expect.anything(),
    );
    await waitFor(() => expect(drawn.markers).toHaveLength(3));
    expect(drawn.route).toMatchObject({ geometry: { type: "LineString" } });
    expect(drawn.dash).toEqual([1, 0]);
  });

  it("says long drives in hours and minutes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ available: true, coordinates: [], distance_m: 128_400, duration_s: 9_300, legs: [] }),
      ),
    );
    render(<PlanRouteMap stops={STOPS} day={1} copy={copy} />);
    await screen.findByText("128.4 km · about 2 h 35 min by car, without traffic");
  });

  it("falls back to straight lines when no road route is available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ available: false })),
    );
    render(<PlanRouteMap stops={STOPS} day={1} copy={copy} />);
    await screen.findByText(copy.routeStraight);
    await waitFor(() => expect(drawn.dash).toEqual([1.5, 1.5]));
  });

  it("hands live traffic to Google Maps and Waze", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ available: false })),
    );
    render(<PlanRouteMap stops={STOPS} day={1} copy={copy} />);
    const google = screen.getByRole("link", { name: copy.routeGoogle });
    expect(google).toHaveAttribute("target", "_blank");
    expect(google.getAttribute("href")).toContain("destination=34.255%2C35.658");
    expect(screen.getByRole("link", { name: copy.routeWaze })).toHaveAttribute(
      "href",
      "https://waze.com/ul?ll=34.123,35.648&navigate=yes",
    );
  });

  it("shows the traveller's position only when asked, and says when location is off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ available: false })),
    );
    const watchPosition = vi.fn((_ok: PositionCallback, fail: PositionErrorCallback) => {
      fail({ code: 1, PERMISSION_DENIED: 1 } as GeolocationPositionError);
      return 7;
    });
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { watchPosition, clearWatch: vi.fn() },
    });
    render(<PlanRouteMap stops={STOPS} day={1} copy={copy} />);
    expect(watchPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: copy.routeLocate }));
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(copy.routeLocateDenied)).toBeInTheDocument();
  });
});
