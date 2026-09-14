"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminCopy } from "@/lib/admin-copy";
import { interpolate } from "@/i18n/translate";
import { fetchAdminTripVersions, fetchInjectionEvents, fetchPlannerHealth } from "@/lib/planner";

export function AdminPlannerHealth() {
  const copy = useAdminCopy();
  const [health, setHealth] = React.useState<{
    injection_events_24h: number;
    planned_sessions_24h: number;
    degraded_sessions_24h: number;
    active_ranker: string | null;
  } | null>(null);
  const [events, setEvents] = React.useState<
    { id: string; kind: string; pattern: string; excerpt: string; created_at: string }[]
  >([]);
  const [tripId, setTripId] = React.useState("");
  const [versions, setVersions] = React.useState<
    { version_id: string; version: number; origin: string; sealed_at: string | null }[]
  >([]);

  React.useEffect(() => {
    void fetchPlannerHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
    void fetchInjectionEvents()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.plannerHealthTitle}</CardTitle>
          <CardDescription>{copy.plannerHealthHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>{interpolate(copy.activeRanker, { value: health?.active_ranker ?? "ranker-v1" })}</p>
          <p>{interpolate(copy.plans24h, { count: health?.planned_sessions_24h ?? 0 })}</p>
          <p>{interpolate(copy.degraded24h, { count: health?.degraded_sessions_24h ?? 0 })}</p>
          <p>{interpolate(copy.injections24h, { count: health?.injection_events_24h ?? 0 })}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.plannerVersions}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="admin-trip-id">{copy.tripIdLabel}</Label>
            <Input
              id="admin-trip-id"
              value={tripId}
              onChange={(event) => setTripId(event.target.value)}
              placeholder={copy.tripIdPlaceholder}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (!tripId.trim()) {
                return;
              }
              void fetchAdminTripVersions(tripId.trim())
                .then(setVersions)
                .catch(() => setVersions([]));
            }}
          >
            {copy.lookupVersions}
          </Button>
          <ul className="grid gap-2 text-sm">
            {versions.map((item) => (
              <li key={item.version_id}>
                v{item.version} · {item.origin} {item.sealed_at ? `· ${copy.sealed}` : ""}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.plannerInjections}</CardTitle>
          <CardDescription>{copy.plannerInjectionsHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-text-muted">{copy.noInjections}</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {events.map((event) => (
                <li key={event.id}>
                  {event.kind} · {event.pattern} · {event.excerpt}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
