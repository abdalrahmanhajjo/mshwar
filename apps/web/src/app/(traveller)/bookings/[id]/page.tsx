"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { BookingTimeline } from "@/components/checkout/booking-timeline";
import { ConfirmationView } from "@/components/checkout/confirmation-view";
import { ShellMain } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocaleLink } from "@/components/shell/locale-link";
import { ArrowLeft } from "lucide-react";
import { cancelCheckoutBooking, fetchConfirmation, fetchTimeline, previewCancel } from "@/lib/checkout";
import { useCheckoutCopy } from "@/lib/checkout-copy";
import { useLocale } from "@/components/shell/locale-provider";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const copy = useCheckoutCopy();
  const { locale } = useLocale();
  const [timeline, setTimeline] = React.useState<Awaited<ReturnType<typeof fetchTimeline>> | null>(null);
  const [confirmation, setConfirmation] = React.useState<Awaited<ReturnType<typeof fetchConfirmation>> | null>(null);
  const [preview, setPreview] = React.useState<{ refund_minor: number; currency: string } | null>(null);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    void fetchTimeline(params.id).then(setTimeline);
    void fetchConfirmation(params.id, locale).then(setConfirmation);
  }, [locale, params.id]);

  return (
    <ShellMain>
      <LocaleLink
        href="/bookings"
        className="inline-flex w-fit items-center gap-2 rounded-sm text-sm text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {copy.viewAllBookings}
      </LocaleLink>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="grid gap-6">
          {confirmation ? (
            <ConfirmationView
              title={confirmation.rendered.title}
              body={confirmation.rendered.body}
              dir={confirmation.rendered.dir}
            />
          ) : (
            <div className="grid gap-2">
              <p className="eyebrow">{copy.bookingRef}</p>
              <h1 className="title-page">{copy.bookingDetailTitle}</h1>
              <p className="font-mono text-sm text-text-muted">{params.id}</p>
            </div>
          )}
          {timeline ? (
            <BookingTimeline title={copy.timeline} events={timeline.timeline} emptyLabel={copy.noEventsYet} />
          ) : null}
        </div>
        <section className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7 lg:sticky lg:top-24">
          <div className="grid gap-1.5">
            <h2 className="title-card">{copy.cancelTitle}</h2>
            <p className="text-sm text-text-muted">{copy.cancelHint}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void previewCancel(params.id).then(setPreview)}>
            {copy.cancelPreview}
          </Button>
          {preview ? (
            <p className="flex items-center justify-between rounded-control bg-surface-sunken px-4 py-3 text-sm">
              <span className="text-text-muted">{copy.refundAmount}</span>
              <span className="font-semibold tabular-nums">
                {preview.refund_minor} {preview.currency}
              </span>
            </p>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="cancel-reason">{copy.cancelReasonLabel}</Label>
            <Input id="cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason.trim()}
            onClick={() =>
              void cancelCheckoutBooking(params.id, reason).then(() => fetchTimeline(params.id).then(setTimeline))
            }
          >
            {copy.confirmCancel}
          </Button>
        </section>
      </div>
    </ShellMain>
  );
}
