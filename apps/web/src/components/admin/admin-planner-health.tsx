"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchInjectionEvents, fetchPlannerHealth } from "@/lib/planner";

export function AdminPlannerHealth() {
  const [health, setHealth] = React.useState<{
    injection_events_24h: number;
    planned_sessions_24h: number;
    degraded_sessions_24h: number;
    active_ranker: string | null;
  } | null>(null);
  const [events, setEvents] = React.useState<
    { id: string; kind: string; pattern: string; excerpt: string; created_at: string }[]
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
          <CardTitle>Planner health</CardTitle>
          <CardDescription>
            Circuit-breaker and injection signals for support. Ranker weights are versioned.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <p>Active ranker: {health?.active_ranker ?? "ranker-v1"}</p>
          <p>Plans (24h): {health?.planned_sessions_24h ?? 0}</p>
          <p>Degraded (24h): {health?.degraded_sessions_24h ?? 0}</p>
          <p>Injection events (24h): {health?.injection_events_24h ?? 0}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Injection attempts</CardTitle>
          <CardDescription>
            User and business text is treated as data. The model cannot book, pay or change a price.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-text-muted">No injection attempts logged.</p>
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
