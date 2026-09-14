"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { bookingAction, inspectBooking, isElevatedTier, listAdminBookings } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";
import { useAuth } from "@/components/shell/auth-provider";

export function BookingInspector() {
  const copy = useAdminCopy();
  const { user } = useAuth();
  const elevated = isElevatedTier(user?.admin_tier);
  const [rows, setRows] = React.useState<{ id: string; status: string; experience_title: string }[]>([]);
  const [detail, setDetail] = React.useState<Awaited<ReturnType<typeof inspectBooking>> | null>(null);
  const [reason, setReason] = React.useState("Support override");

  React.useEffect(() => {
    void listAdminBookings()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.bookingInspector}</CardTitle>
        <CardDescription>{copy.elevatedOnly}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input aria-label="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="underline" onClick={() => void inspectBooking(row.id).then(setDetail)}>
                {row.experience_title} — {row.status}
              </button>
            </li>
          ))}
        </ul>
        {detail ? (
          <section className="grid gap-2 rounded-card border border-border p-3">
            <p className="text-sm">Status: {detail.status}</p>
            <h3 className="text-sm font-semibold">{copy.timeline}</h3>
            <ol className="grid gap-1 text-sm">
              {detail.timeline.map((event, index) => (
                <li key={`${event.created_at}-${index}`}>
                  {event.to_status} {event.reason ? `— ${event.reason}` : ""}
                </li>
              ))}
            </ol>
            <h3 className="text-sm font-semibold">{copy.payments}</h3>
            <ul className="text-sm">
              {detail.payments.map((payment, index) => (
                <li key={`${payment.provider}-${index}`}>
                  {payment.provider} {payment.external_id} {payment.status} {payment.amount_minor}
                </li>
              ))}
            </ul>
            <pre className="overflow-auto text-xs">{JSON.stringify(detail.price_snapshot)}</pre>
            <pre className="overflow-auto text-xs">{JSON.stringify(detail.policy_snapshot)}</pre>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!elevated}
                onClick={() => void bookingAction(detail.id, "force-cancel", reason).then(() => inspectBooking(detail.id).then(setDetail))}
              >
                {copy.forceCancel}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!elevated}
                onClick={() => void bookingAction(detail.id, "mark-refunded", reason).then(() => inspectBooking(detail.id).then(setDetail))}
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
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
