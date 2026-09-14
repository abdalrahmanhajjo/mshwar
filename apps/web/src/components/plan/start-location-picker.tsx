"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlannerCopy } from "@/lib/planner-copy";
import { reversePlace, saveStartLocation, searchPlaces, type PlaceHit, type StartLocation } from "@/lib/planner";
import { LEBANON } from "@/lib/portal";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

function pinFromClick(clientX: number, clientY: number, rect: DOMRect): { lat: number; lng: number } {
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  const lng = LEBANON.lngMin + x * (LEBANON.lngMax - LEBANON.lngMin);
  const lat = LEBANON.latMax - y * (LEBANON.latMax - LEBANON.latMin);
  return { lat, lng };
}

export function StartLocationPicker({
  initial,
  onSaved,
}: {
  initial?: StartLocation | null;
  onSaved?: (value: StartLocation) => void;
}) {
  const copy = usePlannerCopy();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<PlaceHit[]>([]);
  const [label, setLabel] = React.useState(initial?.label ?? "");
  const [lat, setLat] = React.useState(String(initial?.lat ?? LEBANON.beirut.lat));
  const [lng, setLng] = React.useState(String(initial?.lng ?? LEBANON.beirut.lng));
  const [source, setSource] = React.useState<StartLocation["source"]>(initial?.source ?? "manual");
  const [denied, setDenied] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }
    const handle = window.setTimeout(() => {
      void searchPlaces(query)
        .then(setHits)
        .catch(() => setHits([]));
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function applyPlace(place: PlaceHit, nextSource: StartLocation["source"]) {
    setLabel(place.label);
    setLat(String(place.lat));
    setLng(String(place.lng));
    setSource(nextSource);
    setHits([]);
  }

  async function onPin(event: React.MouseEvent<HTMLDivElement>) {
    const point = pinFromClick(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
    const place = await reversePlace(point.lat, point.lng);
    await applyPlace(place, "pin");
  }

  function onLocate() {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDenied(false);
        void reversePlace(position.coords.latitude, position.coords.longitude).then((place) =>
          applyPlace(place, "device"),
        );
      },
      () => setDenied(true),
    );
  }

  async function onSave() {
    setPending(true);
    try {
      const saved = await saveStartLocation({
        lat: Number(lat),
        lng: Number(lng),
        label: label || "Dropped pin",
        source,
      });
      const start = saved.preferences.start_location;
      setStatus(copy.savedStart);
      if (start && onSaved) {
        onSaved(start);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.manualEntry);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.startTitle}</CardTitle>
        <CardDescription>{copy.startHint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="place-search">{copy.searchPlace}</Label>
          <Input
            id="place-search"
            value={query}
            placeholder={copy.searchPlaceholder}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              if (next.trim().length < 2) {
                setHits([]);
              }
            }}
          />
          {hits.length ? (
            <ul className="grid gap-1">
              {hits.map((hit) => (
                <li key={hit.place_id}>
                  <Button type="button" variant="outline" onClick={() => void applyPlace(hit, "search")}>
                    {hit.label}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="grid gap-2">
          <p className="text-sm">{copy.dropPin}</p>
          {!MAPS_KEY ? <p className="text-sm text-text-muted">{copy.mapFallback}</p> : null}
          <div
            role="application"
            aria-label={copy.dropPin}
            className="relative min-h-[220px] cursor-crosshair overflow-hidden rounded-card border border-border bg-surface-sunken"
            onClick={(event) => void onPin(event)}
          >
            <span className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm">
              {label || copy.dropPin}
            </span>
          </div>
        </div>
        <div className="grid gap-2">
          <Button type="button" variant="secondary" onClick={onLocate}>
            {copy.useLocation}
          </Button>
          <p className="text-xs text-text-muted">{copy.precisePermission}</p>
          {denied ? (
            <p role="alert" className="text-sm text-danger">
              {copy.locationDenied}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="start-label">{copy.manualEntry}</Label>
          <Input id="start-label" value={label} onChange={(event) => setLabel(event.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input aria-label="lat" value={lat} onChange={(event) => setLat(event.target.value)} />
            <Input aria-label="lng" value={lng} onChange={(event) => setLng(event.target.value)} />
          </div>
        </div>
        <Button type="button" disabled={pending} onClick={() => void onSave()}>
          {copy.saveStart}
        </Button>
        {status ? (
          <p role="status" className="text-sm">
            {status}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
