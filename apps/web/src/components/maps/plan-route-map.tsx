"use client";

import * as React from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { LocateFixed, LocateOff, Navigation, Route } from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { interpolate } from "@/i18n/catalogues";
import { createLebanonMap } from "@/lib/maplibre";
import type { PlannerCopy } from "@/lib/planner-copy";
import { fetchRoadRoute, googleDirectionsUrl, wazeUrl, type RouteLine } from "@/lib/road-route";
import { useNearViewport } from "@/lib/use-near-viewport";
import { cn, focusRing } from "@/lib/utils";

export type RouteStop = { key: string; lat: number; lng: number; label: string };
type Point = { lat: number; lng: number };

const CEDAR = "#12352F";

type LocateState = "off" | "finding" | "on" | "denied" | "unavailable";

function stopElement(text: string, kind: "stop" | "start" | "you", label: string) {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.title = label;
  element.className =
    kind === "you"
      ? "plan-map-you"
      : cn(
          "grid size-8 place-items-center rounded-full border-2 border-white text-[13px] font-semibold shadow-[0_6px_14px_-4px_rgb(0_0_0/0.45)]",
          kind === "start" ? "bg-[#12352F] text-white" : "bg-[#F3653E] text-white",
        );
  element.textContent = kind === "you" ? "" : text;
  return element;
}

function bounds(points: Point[]): [[number, number], [number, number]] | null {
  const first = points[0];
  if (!first) return null;
  let [west, south, east, north] = [first.lng, first.lat, first.lng, first.lat];
  for (const point of points) {
    west = Math.min(west, point.lng);
    east = Math.max(east, point.lng);
    south = Math.min(south, point.lat);
    north = Math.max(north, point.lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

function frame(map: MapLibreMap, points: Point[]) {
  const box = bounds(points);
  if (!box) return;
  if (points.length === 1) map.easeTo({ center: box[0], zoom: 12, duration: 0 });
  else map.fitBounds(box, { padding: 56, maxZoom: 13, duration: 0 });
}

/** "49 min", or "2 h 35 min" once a drive passes the hour. */
function driveTime(seconds: number, copy: PlannerCopy): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return interpolate(copy.routeMinutes, { m: minutes });
  return interpolate(copy.routeHours, { h: Math.floor(minutes / 60), m: minutes % 60 });
}

/** The route along the roads, or straight dashes between stops when routing is unavailable. */
function drawRoute(map: MapLibreMap, line: RouteLine, points: Point[]) {
  const source = map.getSource("route") as GeoJSONSource | undefined;
  if (!source) return;
  const coordinates = line.available
    ? line.coordinates
    : points.map((point) => [point.lng, point.lat] as [number, number]);
  source.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates } });
  map.setPaintProperty("route", "line-dasharray", line.available ? [1, 0] : [1.5, 1.5]);
}

/**
 * One day of a plan on a real map: numbered stops in order, the road route between them, and,
 * when the traveller asks, their own position. Live traffic and turn-by-turn directions are handed
 * to Google Maps or Waze, which have it; the map itself needs no key and loads nothing from a
 * third party (tiles and routes come through Mshwar's origin).
 */
export function PlanRouteMap({
  stops,
  start,
  day,
  copy,
}: {
  stops: RouteStop[];
  start?: Point | null;
  day: number;
  copy: PlannerCopy;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MapLibreMap | null>(null);
  const markerClass = React.useRef<typeof Marker | null>(null);
  const youMarker = React.useRef<Marker | null>(null);
  const watch = React.useRef<number | null>(null);
  // The map and MapLibre load only once the day is scrolled near.
  const visible = useNearViewport(container);
  const [failed, setFailed] = React.useState(false);
  const [route, setRoute] = React.useState<RouteLine | null>(null);
  // The map's load handler reads the newest route through this ref.
  const routeRef = React.useRef(route);
  React.useEffect(() => {
    routeRef.current = route;
  });
  const [locate, setLocate] = React.useState<LocateState>("off");

  const points = React.useMemo<Point[]>(() => [...(start ? [start] : []), ...stops], [start, stops]);
  const routeKey = points.map((point) => `${point.lng.toFixed(5)},${point.lat.toFixed(5)}`).join(";");

  // The road route, once per set of stops.
  React.useEffect(() => {
    if (!visible || points.length < 2) return;
    const controller = new AbortController();
    fetchRoadRoute(
      points.map((point) => [point.lng, point.lat]),
      controller.signal,
    ).then((line) => {
      if (!controller.signal.aborted) setRoute(line);
    });
    return () => controller.abort();
    // routeKey stands for the points.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, routeKey]);

  // The map with its stops.
  React.useEffect(() => {
    if (!visible || !container.current) return;
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    const markers: Marker[] = [];
    (async () => {
      try {
        const created = await createLebanonMap(container.current as HTMLDivElement);
        instance = created.map;
        if (cancelled) {
          instance.remove();
          return;
        }
        map.current = instance;
        markerClass.current = created.lib.Marker;
        let loaded = false;
        instance.on("error", (event) => {
          if (!loaded) {
            console.warn("plan map failed to load", event.error);
            setFailed(true);
          }
        });
        instance.on("load", () => {
          if (!instance) return;
          loaded = true;
          instance.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          instance.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#FFFFFF", "line-width": 8 },
          });
          instance.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": CEDAR, "line-width": 4.5 },
          });
          if (start) {
            markers.push(
              new created.lib.Marker({ element: stopElement("S", "start", copy.routeStart) })
                .setLngLat([start.lng, start.lat])
                .addTo(instance),
            );
          }
          stops.forEach((stop, index) => {
            if (!instance) return;
            markers.push(
              new created.lib.Marker({ element: stopElement(String(index + 1), "stop", stop.label) })
                .setLngLat([stop.lng, stop.lat])
                .addTo(instance),
            );
          });
          frame(instance, points);
          if (routeRef.current) drawRoute(instance, routeRef.current, points);
        });
      } catch (error) {
        console.warn("plan map unavailable", error);
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.remove());
      instance?.remove();
      map.current = null;
      youMarker.current = null;
    };
    // routeKey stands for the points; copy only names markers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, routeKey]);

  React.useEffect(() => {
    if (route && map.current) drawRoute(map.current, route, points);
    // routeKey stands for the points.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Live position, only while the traveller has it on; it never leaves the device.
  const stopWatching = React.useCallback(() => {
    if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
    youMarker.current?.remove();
    youMarker.current = null;
  }, []);
  React.useEffect(() => stopWatching, [stopWatching]);

  function toggleLocate() {
    if (locate === "on" || locate === "finding") {
      stopWatching();
      setLocate("off");
      return;
    }
    if (!("geolocation" in navigator)) {
      setLocate("unavailable");
      return;
    }
    setLocate("finding");
    let first = true;
    watch.current = navigator.geolocation.watchPosition(
      (position) => {
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        const instance = map.current;
        setLocate("on");
        if (!instance || !markerClass.current) return;
        if (!youMarker.current) {
          youMarker.current = new markerClass.current({ element: stopElement("", "you", copy.routeYou) });
          youMarker.current.setLngLat([here.lng, here.lat]).addTo(instance);
        } else {
          youMarker.current.setLngLat([here.lng, here.lat]);
        }
        if (first) {
          first = false;
          frame(instance, [...points, here]);
        }
      },
      (error) => {
        stopWatching();
        setLocate(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }

  const google = googleDirectionsUrl(stops);
  const firstStop = stops[0];
  const locateNote =
    locate === "finding"
      ? copy.routeLocating
      : locate === "denied"
        ? copy.routeLocateDenied
        : locate === "unavailable"
          ? copy.routeLocateUnavailable
          : null;
  const summary =
    route?.available === true
      ? interpolate(copy.routeRoad, {
          km: (route.distance_m / 1000).toFixed(1),
          time: driveTime(route.duration_s, copy),
        })
      : route?.available === false
        ? copy.routeStraight
        : null;

  const action = cn(
    "inline-flex min-h-11 items-center gap-2 rounded-pill border px-4 text-sm font-semibold transition-colors duration-200",
    focusRing,
  );

  return (
    <div className="grid gap-3">
      {failed ? (
        <p className="rounded-[1rem] border border-border-subtle bg-surface-sunken px-4 py-3 text-sm text-text-muted">
          {copy.routeMapUnavailable}
        </p>
      ) : (
        <div
          ref={container}
          data-plan-map
          role="region"
          aria-label={interpolate(copy.routeMapLabel, { day })}
          className="h-[300px] w-full overflow-hidden rounded-[1.25rem] border border-border-subtle bg-brand-subtle/40 sm:h-[360px]"
        />
      )}

      {summary ? (
        <p className="inline-flex items-center gap-2 text-sm text-text-muted">
          <Route className="size-4 shrink-0 text-brand" aria-hidden />
          {summary}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!failed ? (
          <button
            type="button"
            onClick={toggleLocate}
            aria-pressed={locate === "on" || locate === "finding"}
            className={cn(
              action,
              locate === "on"
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border-subtle bg-surface-raised text-text hover:border-brand/40",
            )}
          >
            {locate === "on" ? (
              <LocateOff className="size-4" aria-hidden />
            ) : (
              <LocateFixed className="size-4" aria-hidden />
            )}
            {locate === "on" ? copy.routeLocateStop : copy.routeLocate}
          </button>
        ) : null}
        {google ? (
          <a
            href={google}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(action, "border-accent bg-accent text-accent-foreground hover:bg-accent/90")}
          >
            <Navigation className="size-4" aria-hidden />
            {copy.routeGoogle}
          </a>
        ) : null}
        {firstStop ? (
          <a
            href={wazeUrl(firstStop)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(action, "border-border-subtle bg-surface-raised text-text hover:border-brand/40")}
          >
            {copy.routeWaze}
          </a>
        ) : null}
      </div>
      <p className="text-xs text-text-muted" aria-live="polite">
        {locateNote ?? copy.routeTrafficNote}
      </p>
    </div>
  );
}
