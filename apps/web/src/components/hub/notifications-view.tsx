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
import { fetchNotifications, markNotificationRead, type NotificationRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";

export function NotificationsView() {
  const copy = useHubCopy();
  const loader = React.useCallback((page: number) => fetchNotifications(page), []);
  const { page, data, error, pending, load, setData } = useHubPage(loader);

  async function onRead(item: NotificationRecord) {
    const next = await markNotificationRead(item.id);
    setData((current) =>
      current ? { ...current, items: current.items.map((row) => (row.id === next.id ? next : row)) } : current,
    );
  }

  return (
    <div className="grid gap-6">
      <HubNav current="/notifications" />
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">{copy.notificationsTitle}</h1>
        <p className="mt-3 text-text-muted">{copy.notificationsBody}</p>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {pending && !data ? <p className="text-sm text-text-muted">{copy.notificationsBody}</p> : null}
      {data && data.items.length === 0 ? (
        <EmptyState
          title={copy.notificationsEmpty}
          description={copy.notificationsEmptyHint}
          action={
            <Button asChild>
              <LocaleLink href="/bookings">{copy.bookingsTitle}</LocaleLink>
            </Button>
          }
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="grid gap-4">
          {data.items.map((item) => {
            const unread = !item.read_at;
            return (
              <Card key={item.id} className={unread ? "border-brand" : undefined}>
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
                  <CardTitle className={unread ? "font-semibold" : "font-medium text-text-muted"}>
                    {item.title}
                  </CardTitle>
                  <Badge variant={unread ? "default" : "outline"}>{unread ? copy.unread : copy.read}</Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-text-muted">{item.body}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.deep_link ? (
                      <Button asChild variant="outline" size="sm">
                        <LocaleLink href={item.deep_link}>{copy.openItem}</LocaleLink>
                      </Button>
                    ) : null}
                    {unread ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => void onRead(item)}>
                        {copy.markRead}
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <HubPagination page={page} total={data.total} onPage={(next) => void load(next)} />
        </div>
      ) : null}
    </div>
  );
}
