"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { BookingTimeline } from "@/components/checkout/booking-timeline";
import { ConfirmationView } from "@/components/checkout/confirmation-view";
import { ShellMain } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
      <div className="mx-auto grid w-full max-w-[390px] gap-4 px-4">
        {confirmation ? (
          <ConfirmationView
            title={confirmation.rendered.title}
            body={confirmation.rendered.body}
            dir={confirmation.rendered.dir}
          />
        ) : null}
        {timeline ? <BookingTimeline title={copy.timeline} events={timeline.timeline} /> : null}
        <Button
          type="button"
          variant="outline"
          onClick={() => void previewCancel(params.id).then(setPreview)}
        >
          {copy.cancelPreview}
        </Button>
        {preview ? (
          <p className="text-sm">
            {copy.refundAmount}: {preview.refund_minor} {preview.currency}
          </p>
        ) : null}
        <Input value={reason} onChange={(event) => setReason(event.target.value)} aria-label={copy.confirmCancel} />
        <Button
          type="button"
          disabled={!reason.trim()}
          onClick={() => void cancelCheckoutBooking(params.id, reason).then(() => fetchTimeline(params.id).then(setTimeline))}
        >
          {copy.confirmCancel}
        </Button>
      </div>
    </ShellMain>
  );
}
