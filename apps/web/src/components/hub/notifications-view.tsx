"use client";

import * as React from "react";
import { ArrowUpRight, Bell, BellDot, Check } from "lucide-react";
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
import { fetchNotifications, markNotificationRead, type NotificationRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";
import { cn } from "@/lib/utils";

export function NotificationsView() {
  const copy = useHubCopy();
  const { locale } = useLocale();
  const loader = React.useCallback((page: number) => fetchNotifications(page), []);
  const { page, data, error, pending, load, setData } = useHubPage(loader);

  async function onRead(item: NotificationRecord) {
    const next = await markNotificationRead(item.id);
    setData((current) =>
      current ? { ...current, items: current.items.map((row) => (row.id === next.id ? next : row)) } : current,
    );
  }

  return (
    <HubFrame
      current="/notifications"
      eyebrow={copy.notificationsKicker}
      title={copy.notificationsTitle}
      description={copy.notificationsBody}
    >
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {pending && !data ? <HubLoading /> : null}
      {data && data.items.length === 0 ? (
        <EmptyState
          icon={<Bell aria-hidden />}
          title={copy.notificationsEmpty}
          description={copy.notificationsEmptyHint}
          action={
            <Button asChild size="lg">
              <LocaleLink href="/bookings">{copy.bookingsTitle}</LocaleLink>
            </Button>
          }
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="grid gap-6">
          <ul className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-surface-raised">
            {data.items.map((item) => {
              const unread = !item.read_at;
              return (
                <li
                  key={item.id}
                  className={cn(
                    "grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-start md:p-6",
                    unread && "bg-brand-subtle/35",
                  )}
                >
                  <span
                    className={cn(
                      "relative grid size-11 place-items-center rounded-full",
                      unread ? "bg-brand text-brand-foreground" : "bg-surface-sunken text-text-muted",
                    )}
                  >
                    {unread ? (
                      <BellDot className="size-5" strokeWidth={1.6} aria-hidden />
                    ) : (
                      <Check className="size-5" strokeWidth={1.6} aria-hidden />
                    )}
                  </span>
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2
                        className={cn(
                          "text-base tracking-tight",
                          unread ? "font-semibold" : "font-medium text-text-muted",
                        )}
                      >
                        {item.title}
                      </h2>
                      <Badge variant={unread ? "accent" : "outline"}>{unread ? copy.unread : copy.read}</Badge>
                    </div>
                    <p className="text-sm leading-relaxed text-text-muted">{item.body}</p>
                    <p className="text-xs text-text-muted">{formatDate(locale, item.created_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {item.deep_link ? (
                      <Button asChild variant="outline" size="sm">
                        <LocaleLink href={item.deep_link}>
                          {copy.openItem}
                          <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
                        </LocaleLink>
                      </Button>
                    ) : null}
                    {unread ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => void onRead(item)}>
                        {copy.markRead}
                      </Button>
                    ) : null}
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
