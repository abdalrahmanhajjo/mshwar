"use client";

import * as React from "react";
import { BookingGate } from "@/components/auth/booking-gate";
import { HubNav } from "@/components/hub/hub-nav";
import { HubPagination } from "@/components/hub/hub-pagination";
import { useHubPage } from "@/components/hub/use-hub-page";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getExperience } from "@/lib/catalog";
import { listMyCheckoutBookings, type CheckoutBooking } from "@/lib/checkout";
import { useCheckoutCopy } from "@/lib/checkout-copy";
import { cancelBooking, fetchBookings, type BookingRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";

const STATUS_VARIANT: Record<string, "secondary" | "success" | "danger" | "warning" | "outline"> = {
  pending: "warning",
  confirmed: "success",
  cancelled: "outline",
  rejected: "danger",
  expired: "secondary",
  completed: "secondary",
};

export function BookingsView() {
  const copy = useHubCopy();
  const checkoutCopy = useCheckoutCopy();
  const loader = React.useCallback((page: number) => fetchBookings(page), []);
  const { page, data, error, pending, load, setData } = useHubPage(loader);
  const [reason, setReason] = React.useState<Record<string, string>>({});
  const [checkoutRows, setCheckoutRows] = React.useState<CheckoutBooking[]>([]);

  React.useEffect(() => {
    void listMyCheckoutBookings()
      .then(setCheckoutRows)
      .catch(() => setCheckoutRows([]));
  }, []);

  async function onCancel(booking: BookingRecord) {
    const next = await cancelBooking(booking.id, (reason[booking.id] ?? "").trim());
    setData((current) =>
      current ? { ...current, items: current.items.map((item) => (item.id === next.id ? next : item)) } : current,
    );
  }

  return (
    <div className="grid gap-6">
      <HubNav current="/bookings" />
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">{copy.bookingsTitle}</h1>
        <p className="mt-3 text-text-muted">{copy.bookingsBody}</p>
      </header>
      <BookingGate />
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {pending && !data ? <p className="text-sm text-text-muted">{copy.bookingsBody}</p> : null}
      {data && data.items.length === 0 ? (
        <EmptyState
          title={copy.bookingsEmpty}
          description={copy.bookingsEmptyHint}
          action={
            <Button asChild>
              <LocaleLink href="/experiences">{copy.browseToBook}</LocaleLink>
            </Button>
          }
        />
      ) : null}
      {Array.isArray(checkoutRows) && checkoutRows.length > 0 ? (
        <div className="grid gap-3">
          {checkoutRows.map((booking) => (
            <Card key={booking.id}>
              <CardHeader>
                <CardTitle>{booking.experience_title}</CardTitle>
                <CardDescription>
                  {booking.status} · {booking.mode}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <LocaleLink href={`/bookings/${booking.id}`}>{checkoutCopy.retrieve}</LocaleLink>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="grid gap-4">
          {data.items.map((booking) => {
            const experience = getExperience(booking.listing_slug);
            const cancellable = booking.status === "pending" || booking.status === "confirmed";
            return (
              <Card key={booking.id}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{experience?.title ?? booking.listing_slug}</CardTitle>
                    <CardDescription>{copy.policySummary}</CardDescription>
                  </div>
                  <Badge variant={STATUS_VARIANT[booking.status] ?? "secondary"}>
                    {copy[booking.status as "pending" | "confirmed" | "cancelled"] ?? booking.status}
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <p className="text-sm text-text-muted">{booking.policy_summary}</p>
                  {booking.reason ? <p className="text-sm text-text">{booking.reason}</p> : null}
                  {cancellable ? (
                    <div className="grid gap-2">
                      <Label htmlFor={`cancel-${booking.id}`}>{copy.cancelReason}</Label>
                      <Input
                        id={`cancel-${booking.id}`}
                        value={reason[booking.id] ?? ""}
                        onChange={(event) => setReason((current) => ({ ...current, [booking.id]: event.target.value }))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!(reason[booking.id] ?? "").trim()}
                        onClick={() => void onCancel(booking)}
                      >
                        {copy.confirmCancel}
                      </Button>
                    </div>
                  ) : null}
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
