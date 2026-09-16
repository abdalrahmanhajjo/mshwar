"use client";

import * as React from "react";
import { Gauge, Route, Search, ShieldAlert, TriangleAlert } from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { StatCard } from "@/components/ui/stat-card";
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
    <div className="grid gap-8">
      <AdminHeader title={copy.plannerHealthTitle} description={copy.plannerHealthHint} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={interpolate(copy.activeRanker, { value: "" }).replace(/:\s*$/, "")}
          value={health?.active_ranker ?? "ranker-v1"}
          icon={<Gauge aria-hidden />}
        />
        <StatCard
          label={interpolate(copy.plans24h, { count: "" }).replace(/:\s*$/, "")}
          value={health?.planned_sessions_24h ?? 0}
          icon={<Route aria-hidden />}
        />
        <StatCard
          label={interpolate(copy.degraded24h, { count: "" }).replace(/:\s*$/, "")}
          value={health?.degraded_sessions_24h ?? 0}
          icon={<TriangleAlert aria-hidden />}
        />
        <StatCard
          label={interpolate(copy.injections24h, { count: "" }).replace(/:\s*$/, "")}
          value={health?.injection_events_24h ?? 0}
          icon={<ShieldAlert aria-hidden />}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.plannerVersions}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="admin-trip-id">{copy.tripIdLabel}</Label>
              <Input
                id="admin-trip-id"
                value={tripId}
                onChange={(event) => setTripId(event.target.value)}
                placeholder={copy.tripIdPlaceholder}
                className="font-mono"
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
              <Search aria-hidden />
              {copy.lookupVersions}
            </Button>
            <ul className="grid gap-1.5 text-sm">
              {versions.map((item) => (
                <li
                  key={item.version_id}
                  className="flex items-center justify-between rounded-control bg-surface-sunken px-3.5 py-2.5"
                >
                  <span className="font-medium">
                    v{item.version} · {item.origin}
                  </span>
                  {item.sealed_at ? <Badge variant="secondary">{copy.sealed}</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.plannerInjections}</CardTitle>
            <CardDescription>{copy.plannerInjectionsHint}</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <Notice tone="success">{copy.noInjections}</Notice>
            ) : (
              <ul className="grid gap-2 text-sm">
                {events.map((event) => (
                  <li key={event.id} className="grid gap-1 rounded-control border border-border-subtle px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Badge variant="danger">{event.kind}</Badge>
                      <span className="font-mono text-xs text-text-muted">{event.pattern}</span>
                    </span>
                    <span className="text-text-muted">{event.excerpt}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
