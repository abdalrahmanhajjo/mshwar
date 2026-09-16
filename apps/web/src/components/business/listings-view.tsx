"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, Clock, Pause, Pencil, Play, Plus, Store } from "lucide-react";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { LocaleLink } from "@/components/shell/locale-link";
import { useBusinessCopy } from "@/lib/business-copy";
import { listExperiences, setExperienceStatus, type PortalExperience } from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function ListingsView() {
  const copy = useBusinessCopy();
  const { org } = usePortal();
  const [items, setItems] = React.useState<PortalExperience[]>([]);

  const reload = React.useCallback(async () => {
    if (!org) {
      return;
    }
    try {
      setItems(await listExperiences(org.id));
    } catch {
      setItems([]);
    }
  }, [org]);

  React.useEffect(() => {
    if (!org) {
      return;
    }
    let cancelled = false;
    void listExperiences(org.id)
      .then((next) => {
        if (!cancelled) {
          setItems(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [org]);

  async function toggle(item: PortalExperience) {
    if (!org) {
      return;
    }
    const next = item.status === "paused" ? "published" : "paused";
    await setExperienceStatus(org.id, item.id, next);
    await reload();
  }

  if (!org) {
    return <EmptyState icon={<Store aria-hidden />} title={copy.noOrgs} />;
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.portalKicker}
        title={copy.listingsTitle}
        description={copy.listingsHint}
        actions={
          <Button asChild size="lg">
            <LocaleLink href="/business/listings/new">
              <Plus aria-hidden />
              {copy.newListing}
            </LocaleLink>
          </Button>
        }
      />
      {org.verification !== "verified" ? <Notice tone="warning">{copy.cannotPublish}</Notice> : null}
      {items.length === 0 ? (
        <EmptyState
          icon={<Store aria-hidden />}
          title={copy.emptyListings}
          action={
            <Button asChild>
              <LocaleLink href="/business/listings/new">{copy.newListing}</LocaleLink>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm md:grid-cols-[1fr_auto] md:items-center md:p-6"
            >
              <div className="flex min-w-0 gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-[1rem] bg-brand-subtle">
                  <Store className="size-6" strokeWidth={1.5} aria-hidden />
                </span>
                <div className="grid min-w-0 gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="title-card">{item.title}</h2>
                    <Badge
                      variant={
                        item.status === "published" ? "success" : item.status === "paused" ? "warning" : "secondary"
                      }
                    >
                      {item.status === "published"
                        ? copy.published
                        : item.status === "paused"
                          ? copy.paused
                          : copy.draft}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-text-muted">{item.description}</p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden />
                      {item.duration_minutes} {copy.durationHint.toLowerCase()}
                    </span>
                    <span>
                      {copy.bookingMode}: {item.booking_mode}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button asChild variant="outline" size="sm">
                  <LocaleLink href={`/business/listings/${item.id}`}>
                    <Pencil aria-hidden />
                    {copy.editListing}
                  </LocaleLink>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <LocaleLink href={`/business/listings/${item.id}/availability`}>
                    <CalendarClock aria-hidden />
                    {copy.availabilityTitle}
                  </LocaleLink>
                </Button>
                {item.status === "published" || item.status === "paused" ? (
                  <Button variant="secondary" size="sm" onClick={() => void toggle(item)}>
                    {item.status === "paused" ? <Play aria-hidden /> : <Pause aria-hidden />}
                    {item.status === "paused" ? copy.unpause : copy.pause}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
