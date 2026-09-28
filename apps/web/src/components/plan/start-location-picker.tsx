"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LocateFixed, MapPin, Save, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlannerCopy } from "@/lib/planner-copy";
import { reversePlace, saveStartLocation, searchPlaces, type PlaceHit, type StartLocation } from "@/lib/planner";
import { LEBANON } from "@/lib/portal";
import { PickMap } from "@/components/maps/pick-map";

export function StartLocationPicker({
  initial,
  onSaved,
  standalone = false,
}: {
  initial?: StartLocation | null;
  onSaved?: (value: StartLocation) => void;
  standalone?: boolean;
}) {
  const copy = usePlannerCopy();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<PlaceHit[]>([]);
  // Results only make sense for a query that is still long enough to search.
  const visibleHits = query.trim().length < 2 ? [] : hits;
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
    // Ignore answers for a query the user has already moved past.
    let current = true;
    const handle = window.setTimeout(() => {
      void searchPlaces(query)
        .then((found) => current && setHits(found))
        .catch(() => current && setHits([]));
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  async function applyPlace(place: PlaceHit, nextSource: StartLocation["source"]) {
    setLabel(place.label);
    setLat(String(place.lat));
    setLng(String(place.lng));
    setSource(nextSource);
    setHits([]);
  }

  async function onPin(point: { lat: number; lng: number }) {
    // The pin is where it was dropped even before its name comes back.
    setLat(String(point.lat));
    setLng(String(point.lng));
    setSource("pin");
    const place = await reversePlace(point.lat, point.lng).catch(() => null);
    if (place) await applyPlace({ ...place, lat: point.lat, lng: point.lng }, "pin");
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

  const [mapFailed, setMapFailed] = React.useState(false);
  const point =
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null;
  const Heading = standalone ? "h1" : "h3";

  return (
    <section className="grid gap-6 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7">
      <header className="grid gap-2">
        {standalone ? <p className="eyebrow">{copy.routeStart}</p> : null}
        <Heading className={standalone ? "title-page" : "title-card"}>{copy.startTitle}</Heading>
        <p className="text-sm leading-relaxed text-text-muted">{copy.startHint}</p>
      </header>
      <div className={cn("grid gap-6", standalone && "lg:grid-cols-[1fr_1.1fr]")}>
        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            <Label htmlFor="place-search">{copy.searchPlace}</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
                aria-hidden
              />
              <Input
                id="place-search"
                value={query}
                placeholder={copy.searchPlaceholder}
                className="ps-10"
                onChange={(event) => {
                  const next = event.target.value;
                  setQuery(next);
                  if (next.trim().length < 2) {
                    setHits([]);
                  }
                }}
              />
            </div>
            {visibleHits.length ? (
              <ul className="grid gap-1 rounded-control border border-border-subtle bg-surface-raised p-1.5 shadow-md">
                {visibleHits.map((hit) => (
                  <li key={hit.place_id}>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full justify-start rounded-[0.6rem]"
                      onClick={() => void applyPlace(hit, "search")}
                    >
                      <MapPin aria-hidden />
                      {hit.label}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="grid gap-2">
            <Button type="button" variant="outline" onClick={onLocate}>
              <LocateFixed aria-hidden />
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
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label="lat"
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                className="tabular-nums"
              />
              <Input
                aria-label="lng"
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                className="tabular-nums"
              />
            </div>
          </div>
        </div>
        <div className="grid content-start gap-2">
          <p className="text-sm font-medium">{copy.dropPin}</p>
          {mapFailed ? (
            <p className="rounded-card border border-border-subtle bg-surface-sunken px-4 py-3 text-sm text-text-muted">
              {copy.mapFallback}
            </p>
          ) : (
            <PickMap
              value={point}
              onPick={(picked) => void onPin(picked)}
              onError={() => setMapFailed(true)}
              label={copy.dropPin}
            />
          )}
          {label ? <p className="truncate text-sm font-medium">{label}</p> : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-5">
        <Button type="button" disabled={pending} onClick={() => void onSave()}>
          <Save aria-hidden />
          {copy.saveStart}
        </Button>
        {status ? (
          <p role="status" className="text-sm text-text-muted">
            {status}
          </p>
        ) : null}
      </div>
    </section>
  );
}
