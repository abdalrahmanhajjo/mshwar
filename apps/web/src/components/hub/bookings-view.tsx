"use client";

import * as React from "react";
import { ArrowUpRight, CalendarDays, ReceiptText, Ticket, Users } from "lucide-react";
import { BookingGate } from "@/components/auth/booking-gate";
import { CatalogImage } from "@/components/browse/catalog-image";
import { HubFrame } from "@/components/hub/hub-nav";
import { HubLoading, HubPagination } from "@/components/hub/hub-pagination";
import { useHubPage } from "@/components/hub/use-hub-page";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { formatCurrency, formatDate } from "@/i18n/format";
import { getExperience } from "@/lib/catalog";
import { listMyCheckoutBookings, type CheckoutBooking } from "@/lib/checkout";
import { useCheckoutCopy } from "@/lib/checkout-copy";
import { cancelBooking, fetchBookings, type BookingRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";
import { BOOKING_STATUS_VARIANT } from "@/lib/status";

export function BookingsView() {
  const copy = useHubCopy();
  const checkoutCopy = useCheckoutCopy();
  const { locale } = useLocale();
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
    <HubFrame
      current="/bookings"
      eyebrow={copy.bookingsKicker}
      title={copy.bookingsTitle}
      description={copy.bookingsBody}
    >
      <BookingGate />
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {pending && !data ? <HubLoading /> : null}

      {Array.isArray(checkoutRows) && checkoutRows.length > 0 ? (
        <section className="grid gap-4" aria-labelledby="checkout-bookings-heading">
          <h2 id="checkout-bookings-heading" className="eyebrow">
            {copy.checkoutBookings}
          </h2>
          <ul className="grid gap-3">
            {checkoutRows.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-col gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-subtle">
                    <ReceiptText className="size-5" strokeWidth={1.6} aria-hidden />
                  </span>
                  <div className="grid min-w-0 gap-1">
                    <p className="truncate font-semibold tracking-tight">{booking.experience_title}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
                      <Badge variant={BOOKING_STATUS_VARIANT[booking.status] ?? "secondary"}>{booking.status}</Badge>
                      <span>{booking.mode}</span>
                      {booking.party_size ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden />
                          {booking.party_size}
                        </span>
                      ) : null}
                      {booking.total_minor != null ? (
                        <span className="font-medium text-text">
                          {formatCurrency(locale, booking.total_minor / 100, booking.currency || "USD")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm">
                  <LocaleLink href={`/bookings/${booking.id}`}>
                    {checkoutCopy.retrieve}
                    <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
                  </LocaleLink>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          icon={<Ticket aria-hidden />}
          title={copy.bookingsEmpty}
          description={copy.bookingsEmptyHint}
          action={
            <Button asChild size="lg">
              <LocaleLink href="/experiences">{copy.browseToBook}</LocaleLink>
            </Button>
          }
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <section className="grid gap-4" aria-labelledby="listing-bookings-heading">
          <h2 id="listing-bookings-heading" className="eyebrow">
            {copy.listingBookings}
          </h2>
          <ul className="grid gap-4">
            {data.items.map((booking) => {
              const experience = getExperience(booking.listing_slug);
              const cancellable = booking.status === "pending" || booking.status === "confirmed";
              return (
                <li
                  key={booking.id}
                  className="grid overflow-hidden rounded-card border border-border-subtle bg-surface-raised shadow-sm md:grid-cols-[13rem_1fr]"
                >
                  <div className="relative aspect-[16/9] bg-brand-subtle md:aspect-auto">
                    {experience ? (
                      <CatalogImage src={experience.image} alt={experience.imageAlt} className="absolute inset-0" />
                    ) : (
                      <Ticket className="absolute inset-0 m-auto size-8 text-text-muted" aria-hidden />
                    )}
                  </div>
                  <div className="grid gap-4 p-5 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid gap-1">
                        <h3 className="title-card">{experience?.title ?? booking.listing_slug}</h3>
                        <p className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                          <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
                          {copy.bookedOn} {formatDate(locale, booking.created_at)}
                        </p>
                      </div>
                      <Badge variant={BOOKING_STATUS_VARIANT[booking.status] ?? "secondary"}>
                        {copy[booking.status as "pending" | "confirmed" | "cancelled"] ?? booking.status}
                      </Badge>
                    </div>
                    <div className="grid gap-1 rounded-control bg-surface-sunken px-4 py-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                        {copy.policySummary}
                      </p>
                      <p className="text-text">{booking.policy_summary}</p>
                      {booking.reason ? <p className="text-text-muted">{booking.reason}</p> : null}
                    </div>
                    {cancellable ? (
                      <div className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                        <Field id={`cancel-${booking.id}`} label={copy.cancelReason}>
                          <Input
                            value={reason[booking.id] ?? ""}
                            onChange={(event) =>
                              setReason((current) => ({ ...current, [booking.id]: event.target.value }))
                            }
                          />
                        </Field>
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
                  </div>
                </li>
              );
            })}
          </ul>
          <HubPagination page={page} total={data.total} onPage={(next) => void load(next)} />
        </section>
      ) : null}
    </HubFrame>
  );
}
