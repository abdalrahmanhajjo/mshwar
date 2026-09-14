"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchNotificationHealth,
  listAdminNotifications,
  resendNotification,
  type AdminNotificationRow,
  type NotificationHealth,
} from "@/lib/notifications";
import { useNotificationCopy } from "@/lib/notifications-copy";

export function NotificationHealthView() {
  const copy = useNotificationCopy();
  const [health, setHealth] = React.useState<NotificationHealth | null>(null);
  const [rows, setRows] = React.useState<AdminNotificationRow[]>([]);
  const [reason, setReason] = React.useState("Customer requested a resend");

  const reload = React.useCallback(async () => {
    try {
      const [nextHealth, nextRows] = await Promise.all([fetchNotificationHealth(), listAdminNotifications("failed")]);
      setHealth(nextHealth);
      setRows(nextRows);
    } catch {
      setHealth(null);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void fetchNotificationHealth()
      .then((payload) => {
        if (!cancelled) {
          setHealth(payload);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHealth(null);
        }
      });
    void listAdminNotifications("failed")
      .then((payload) => {
        if (!cancelled) {
          setRows(payload);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.healthTitle}</CardTitle>
        <CardDescription>{health?.backoff}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-card border border-border p-3">
            <dt className="text-sm">{copy.outboxDepth}</dt>
            <dd className="text-title">{health?.outbox_depth ?? 0}</dd>
          </div>
          <div className="rounded-card border border-border p-3">
            <dt className="text-sm">{copy.deadLetters}</dt>
            <dd className="text-title">{health?.dead_letters ?? 0}</dd>
          </div>
          <div className="rounded-card border border-border p-3">
            <dt className="text-sm">{copy.pending}</dt>
            <dd className="text-title">{health?.pending ?? 0}</dd>
          </div>
        </dl>
        <section>
          <h2 className="text-lg font-medium">{copy.channelRates}</h2>
          <ul className="mt-2 grid gap-2 text-sm">
            {(health?.channels ?? []).map((row) => (
              <li key={row.channel}>
                {row.channel}: delivery {row.delivery_rate} / failure {row.failure_rate}
              </li>
            ))}
          </ul>
        </section>
        <div className="grid gap-2">
          <label className="text-sm" htmlFor="resend-reason">
            {copy.resendReason}
          </label>
          <Input id="resend-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2">
              <span className="text-sm">
                {row.event_type} · {row.channel} · {row.attempts}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void resendNotification(row.id, reason).then(reload)}
              >
                {copy.resend}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
