"use client";

import * as React from "react";
import { HubNav } from "@/components/hub/hub-nav";
import { HubPagination } from "@/components/hub/hub-pagination";
import { useHubPage } from "@/components/hub/use-hub-page";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { archiveTrip, fetchTrips, type TripRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";

const STATUS_VARIANT: Record<string, "secondary" | "warning" | "outline"> = {
  draft: "secondary",
  locked: "warning",
  archived: "outline",
};

export function TripsView() {
  const copy = useHubCopy();
  const loader = React.useCallback((page: number) => fetchTrips(page), []);
  const { page, data, error, pending, load, setData } = useHubPage(loader);

  async function onArchive(trip: TripRecord) {
    const next = await archiveTrip(trip.id);
    setData((current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === next.id ? next : item)) } : current,
    );
  }

  return (
    <div className="grid gap-6">
      <HubNav current="/trips" />
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">{copy.tripsTitle}</h1>
        <p className="mt-3 text-text-muted">{copy.tripsBody}</p>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {pending && !data ? <p className="text-sm text-text-muted">{copy.tripsBody}</p> : null}
      {data && data.items.length === 0 ? (
        <EmptyState
          title={copy.tripsEmpty}
          description={copy.tripsEmptyHint}
          action={
            <Button asChild>
              <LocaleLink href="/plan">{copy.planTrip}</LocaleLink>
            </Button>
          }
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="grid gap-4">
          {data.items.map((trip) => (
            <Card key={trip.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-title">{trip.name}</CardTitle>
                <Badge variant={STATUS_VARIANT[trip.status] ?? "secondary"}>
                  {copy[trip.status as "draft" | "locked" | "archived"] ?? trip.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-text-muted">{new Date(trip.created_at).toLocaleDateString()}</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="secondary" size="sm">
                    <LocaleLink href={`/plan?trip=${trip.id}`}>{copy.planTrip}</LocaleLink>
                  </Button>
                  {trip.status === "archived" ? null : (
                    <Button type="button" variant="outline" size="sm" onClick={() => void onArchive(trip)}>
                      {copy.archiveTrip}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          <HubPagination page={page} total={data.total} onPage={(next) => void load(next)} />
        </div>
      ) : null}
    </div>
  );
}
