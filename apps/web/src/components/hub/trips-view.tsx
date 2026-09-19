"use client";

import * as React from "react";
import { Archive, CalendarDays, LayoutDashboard, Lock, Plus, Route, SearchX } from "lucide-react";
import { HubFrame } from "@/components/hub/hub-nav";
import { HubLoading, HubPagination } from "@/components/hub/hub-pagination";
import { useHubPage } from "@/components/hub/use-hub-page";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { formatDate } from "@/i18n/format";
import { useGroupCopy } from "@/lib/group-copy";
import { archiveTrip, fetchTrips, type TripRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "secondary" | "warning" | "outline"> = {
  draft: "secondary",
  locked: "warning",
  archived: "outline",
};

const STATUS_ACCENT: Record<string, string> = {
  draft: "bg-brand",
  locked: "bg-warning",
  archived: "bg-border-strong",
};

export function TripsView() {
  const copy = useHubCopy();
  const groupCopy = useGroupCopy();
  const { locale } = useLocale();
  const loader = React.useCallback((page: number) => fetchTrips(page), []);
  const { page, data, error, pending, load, setData } = useHubPage(loader);

  async function onArchive(trip: TripRecord) {
    const next = await archiveTrip(trip.id);
    setData((current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === next.id ? next : item)) } : current,
    );
  }

  const activeCount = data?.items.filter((trip) => trip.status !== "archived").length ?? 0;

  return (
    <HubFrame
      current="/trips"
      eyebrow={copy.tripsKicker}
      title={copy.tripsTitle}
      description={copy.tripsBody}
      actions={
        <Button asChild size="lg">
          <LocaleLink href="/plan/start">
            <Plus aria-hidden />
            {copy.newTrip}
          </LocaleLink>
        </Button>
      }
    >
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {pending && !data ? <HubLoading /> : null}
      {data && data.items.length === 0 ? (
        <EmptyState
          icon={<SearchX aria-hidden />}
          title={copy.tripsEmpty}
          description={copy.tripsEmptyHint}
          action={
            <Button asChild size="lg">
              <LocaleLink href="/plan">{copy.planTrip}</LocaleLink>
            </Button>
          }
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="grid gap-6">
          {activeCount > 0 ? (
            <p className="text-sm text-text-muted">
              {activeCount} {activeCount === 1 ? "active tour" : "active tours"} · {data.total} total
            </p>
          ) : null}
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.items.map((trip) => {
              const locked = trip.status === "locked";
              return (
                <li
                  key={trip.id}
                  className={cn(
                    "group relative grid overflow-hidden rounded-card border border-border-subtle bg-surface-raised shadow-sm transition-shadow hover:shadow-md",
                    trip.status === "archived" && "opacity-75",
                  )}
                >
                  <span aria-hidden className={cn("h-1.5 w-full", STATUS_ACCENT[trip.status] ?? "bg-border-strong")} />
                  <div className="grid gap-5 p-5 md:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-12 place-items-center rounded-full bg-brand-subtle text-text">
                        <Route className="size-5" strokeWidth={1.6} aria-hidden />
                      </span>
                      <Badge variant={STATUS_VARIANT[trip.status] ?? "secondary"}>
                        {locked ? (
                          <>
                            <Lock className="size-3" aria-hidden />
                            {groupCopy.statusLocked}
                          </>
                        ) : trip.status === "archived" ? (
                          groupCopy.statusArchived
                        ) : (
                          groupCopy.statusDraft
                        )}
                      </Badge>
                    </div>
                    <div className="grid gap-1">
                      <h2 className="title-card text-[1.3rem] leading-snug">{trip.name}</h2>
                      <p className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                        <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
                        {copy.createdOn} {formatDate(locale, trip.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-4">
                      <Button asChild size="sm">
                        <LocaleLink href={`/plan?trip=${trip.id}`}>
                          <Route aria-hidden />
                          {copy.openTrip}
                        </LocaleLink>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <LocaleLink href={`/trips/${trip.id}`}>
                          <LayoutDashboard aria-hidden />
                          {groupCopy.openGroup}
                        </LocaleLink>
                      </Button>
                      {trip.status === "archived" ? null : (
                        <Button type="button" variant="ghost" size="sm" onClick={() => void onArchive(trip)}>
                          <Archive aria-hidden />
                          {copy.archiveTrip}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <HubPagination page={page} total={data.total} onPage={(next) => void load(next)} />
        </div>
      ) : null}
    </HubFrame>
  );
}
