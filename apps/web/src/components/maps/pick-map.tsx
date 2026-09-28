"use client";

import * as React from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { createLebanonMap } from "@/lib/maplibre";

type Point = { lat: number; lng: number };

function pinElement() {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.className =
    "size-6 rounded-full border-[3px] border-white bg-[#F3653E] shadow-[0_6px_14px_-4px_rgb(0_0_0/0.5)] cursor-grab";
  return element;
}

/**
 * The real map of Lebanon to choose a point on: tap to drop the pin, or drag it. Search, the
 * device location and the typed coordinates beside it remain the keyboard way to set the point.
 */
export function PickMap({
  value,
  onPick,
  onError,
  label,
}: {
  value: Point | null;
  onPick: (point: Point) => void;
  onError: () => void;
  label: string;
}) {
  const container = React.useRef<HTMLDivElement>(null);
  const map = React.useRef<MapLibreMap | null>(null);
  const marker = React.useRef<Marker | null>(null);
  const latest = React.useRef({ value, onPick, onError });
  React.useEffect(() => {
    latest.current = { value, onPick, onError };
  });

  React.useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let instance: MapLibreMap | null = null;
    (async () => {
      try {
        const start = latest.current.value;
        const created = await createLebanonMap(container.current as HTMLDivElement, {
          ...(start ? { center: [start.lng, start.lat] as [number, number], zoom: 11 } : {}),
        });
        instance = created.map;
        if (cancelled) {
          instance.remove();
          return;
        }
        map.current = instance;
        let loaded = false;
        instance.on("error", (event) => {
          if (!loaded) {
            console.warn("pick map failed to load", event.error);
            latest.current.onError();
          }
        });
        instance.on("load", () => {
          loaded = true;
        });
        const pin = new created.lib.Marker({ element: pinElement(), draggable: true });
        if (start) pin.setLngLat([start.lng, start.lat]).addTo(instance);
        marker.current = pin;
        pin.on("dragend", () => {
          const at = pin.getLngLat();
          latest.current.onPick({ lat: at.lat, lng: at.lng });
        });
        instance.on("click", (event) => {
          if (!instance) return;
          pin.setLngLat(event.lngLat).addTo(instance);
          latest.current.onPick({ lat: event.lngLat.lat, lng: event.lngLat.lng });
        });
      } catch (error) {
        console.warn("pick map unavailable", error);
        if (!cancelled) latest.current.onError();
      }
    })();
    return () => {
      cancelled = true;
      marker.current?.remove();
      instance?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  // A point set another way (search, device, typed) moves the pin and the view.
  React.useEffect(() => {
    const instance = map.current;
    const pin = marker.current;
    if (!instance || !pin || !value) return;
    const at = pin.getLngLat?.();
    if (at && Math.abs(at.lat - value.lat) < 1e-6 && Math.abs(at.lng - value.lng) < 1e-6) return;
    pin.setLngLat([value.lng, value.lat]).addTo(instance);
    instance.easeTo({ center: [value.lng, value.lat], zoom: Math.max(instance.getZoom(), 11) });
  }, [value]);

  return (
    <div
      ref={container}
      data-pick-map
      role="region"
      aria-label={label}
      className="h-[300px] w-full overflow-hidden rounded-card border border-border-subtle bg-brand-subtle/60 sm:h-[340px]"
    />
  );
}
