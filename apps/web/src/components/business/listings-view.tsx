"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    void reload();
  }, [reload]);

  async function toggle(item: PortalExperience) {
    if (!org) {
      return;
    }
    const next = item.status === "paused" ? "published" : "paused";
    await setExperienceStatus(org.id, item.id, next);
    await reload();
  }

  if (!org) {
    return <EmptyState title={copy.noOrgs} />;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title">{copy.listingsHint}</h1>
          {org.verification !== "verified" ? <p className="text-sm text-warning">{copy.cannotPublish}</p> : null}
        </div>
        <Button asChild>
          <LocaleLink href="/business/listings/new">{copy.newListing}</LocaleLink>
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState title={copy.emptyListings} />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {item.title}
                  <Badge
                    variant={
                      item.status === "published" ? "success" : item.status === "paused" ? "warning" : "secondary"
                    }
                  >
                    {item.status === "published" ? copy.published : item.status === "paused" ? copy.paused : copy.draft}
                  </Badge>
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <LocaleLink href={`/business/listings/${item.id}`}>{copy.saveListing}</LocaleLink>
                </Button>
                <Button asChild variant="ghost">
                  <LocaleLink href={`/business/listings/${item.id}/availability`}>{copy.hoursTitle}</LocaleLink>
                </Button>
                {item.status === "published" || item.status === "paused" ? (
                  <Button variant="secondary" onClick={() => void toggle(item)}>
                    {item.status === "paused" ? copy.unpause : copy.pause}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
