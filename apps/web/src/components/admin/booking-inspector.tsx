"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, SearchCheck } from "lucide-react";
import { AdminHeader, ReasonField } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { statusTone } from "@/lib/status";
import { cn, focusRing } from "@/lib/utils";
import { bookingAction, inspectBooking, isElevatedTier, listAdminBookings, listReconciliationQueue } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";
import { useAuth } from "@/components/shell/auth-provider";

export function BookingInspector() {
  const copy = useAdminCopy();
  const { user } = useAuth();
  const elevated = isElevatedTier(user?.admin_tier);
  const [rows, setRows] = React.useState<{ id: string; status: string; experience_title: string }[]>([]);
  const [queue, setQueue] = React.useState<{ id: string; booking_id: string; kind: string }[]>([]);
  const [detail, setDetail] = React.useState<Awaited<ReturnType<typeof inspectBooking>> | null>(null);
  const [reason, setReason] = React.useState("Support override");

  React.useEffect(() => {
    void listAdminBookings()
      .then(setRows)
      .catch(() => setRows([]));
    void listReconciliationQueue()
      .then((items) => setQueue(items ?? []))
      .catch(() => setQueue([]));
  }, []);

  return (
    <div className="grid gap-8">
      <AdminHeader title={copy.bookingInspector} description={copy.elevatedOnly} />
      {elevated ? null : <Notice tone="warning">{copy.elevatedOnly}</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] lg:items-start">
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.bookingsList}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1.5">
              {rows.length === 0 ? <p className="text-sm text-text-muted">{copy.queueEmpty}</p> : null}
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void inspectBooking(row.id).then(setDetail)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-control border px-3.5 py-2.5 text-start text-sm transition-colors",
                    detail?.id === row.id
                      ? "border-brand bg-brand-subtle/50"
                      : "border-border-subtle hover:bg-surface-sunken",
                    focusRing,
                  )}
                >
                  <span className="font-medium">{row.experience_title}</span>
                  <Badge variant={statusTone(row.status)}>{row.status}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.reconciliationQueue}</CardTitle>
            </CardHeader>
            <CardContent>
              {queue.length === 0 ? <p className="text-sm text-text-muted">{copy.queueEmpty}</p> : null}
              <ul className="grid gap-1.5 text-sm">
                {queue.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-control bg-surface-sunken px-3.5 py-2.5"
                  >
                    <Badge variant="warning">{item.kind}</Badge>
                    <span className="truncate font-mono text-xs text-text-muted">{item.booking_id}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
        <Card className="lg:sticky lg:top-24">
          {detail ? (
            <CardContent className="grid gap-6 pt-6 md:pt-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="title-card">{copy.bookingInspector}</h2>
                <Badge variant={statusTone(detail.status)}>{detail.status}</Badge>
              </div>
              <section className="grid gap-3">
                <h3 className="text-sm font-semibold">{copy.timeline}</h3>
                <ol className="grid gap-2 text-sm">
                  {detail.timeline.map((event, index) => (
                    <li
                      key={`${event.created_at}-${index}`}
                      className="grid gap-0.5 border-s-2 border-border-subtle ps-3"
                    >
                      <span className="font-semibold capitalize">{event.to_status}</span>
                      {event.reason ? <span className="text-text-muted">{event.reason}</span> : null}
                    </li>
                  ))}
                </ol>
              </section>
              <section className="grid gap-3">
                <h3 className="text-sm font-semibold">{copy.payments}</h3>
                <ul className="grid gap-1.5 text-sm">
                  {detail.payments.map((payment, index) => (
                    <li
                      key={`${payment.provider}-${index}`}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-control bg-surface-sunken px-3.5 py-2.5"
                    >
                      <CreditCard className="size-4 text-text-muted" aria-hidden />
                      <span className="truncate">
                        {payment.provider}{" "}
                        <span className="font-mono text-xs text-text-muted">{payment.external_id}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={statusTone(payment.status)}>{payment.status}</Badge>
                        <span className="tabular-nums">{payment.amount_minor}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <details className="rounded-control border border-border-subtle">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{copy.snapshots}</summary>
                <div className="grid gap-2 px-4 pb-4">
                  <pre className="overflow-auto rounded-control bg-surface-sunken p-3 text-xs">
                    {JSON.stringify(detail.price_snapshot, null, 2)}
                  </pre>
                  <pre className="overflow-auto rounded-control bg-surface-sunken p-3 text-xs">
                    {JSON.stringify(detail.policy_snapshot, null, 2)}
                  </pre>
                </div>
              </details>
              <div className="grid gap-4 border-t border-border-subtle pt-5">
                <ReasonField id="booking-reason" value={reason} onChange={setReason} />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={!elevated}
                    onClick={() =>
                      void bookingAction(detail.id, "force-cancel", reason).then(() =>
                        inspectBooking(detail.id).then(setDetail),
                      )
                    }
                  >
                    {copy.forceCancel}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!elevated}
                    onClick={() =>
                      void bookingAction(detail.id, "mark-refunded", reason).then(() =>
                        inspectBooking(detail.id).then(setDetail),
                      )
                    }
                  >
                    {copy.markRefunded}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!elevated}
                    onClick={() => void bookingAction(detail.id, "resend-confirmation", reason)}
                  >
                    {copy.resendConfirmation}
                  </Button>
                </div>
              </div>
            </CardContent>
          ) : (
            <CardContent className="grid place-items-center gap-3 py-16 text-center md:py-20">
              <SearchCheck className="size-8 text-text-muted" strokeWidth={1.5} aria-hidden />
              <p className="max-w-xs text-sm text-text-muted">{copy.selectBooking}</p>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
