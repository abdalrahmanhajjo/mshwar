"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Clock, Inbox, MailWarning, RotateCw } from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
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
    <div className="grid gap-8">
      <AdminHeader title={copy.healthTitle} description={health?.backoff} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={copy.outboxDepth} value={health?.outbox_depth ?? 0} icon={<Inbox aria-hidden />} />
        <StatCard label={copy.deadLetters} value={health?.dead_letters ?? 0} icon={<MailWarning aria-hidden />} />
        <StatCard label={copy.pending} value={health?.pending ?? 0} icon={<Clock aria-hidden />} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.channelRates}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {(health?.channels ?? []).map((row) => {
              const delivery = Number(row.delivery_rate) || 0;
              const pct = delivery <= 1 ? delivery * 100 : delivery;
              return (
                <div key={row.channel} className="grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold capitalize">{row.channel}</span>
                    <span className="text-text-muted">
                      {row.delivery_rate} / {row.failure_rate}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-pill bg-danger-subtle" aria-hidden data-rtl-chart>
                    <div className="h-full rounded-pill bg-success" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.deadLetters}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="resend-reason">{copy.resendReason}</Label>
              <Input id="resend-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <ul className="grid gap-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle px-4 py-3"
                >
                  <span className="grid text-sm">
                    <span className="font-mono text-xs">{row.event_type}</span>
                    <span className="text-text-muted">
                      {row.channel} · {row.attempts}×
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void resendNotification(row.id, reason).then(reload)}
                  >
                    <RotateCw aria-hidden />
                    {copy.resend}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
