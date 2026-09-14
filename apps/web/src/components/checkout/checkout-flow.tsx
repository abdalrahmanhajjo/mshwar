"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BookingGate } from "@/components/auth/booking-gate";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  commitCheckout,
  fetchSlots,
  payCheckout,
  quoteCheckout,
  sendInquiry,
  type CheckoutQuote,
  type CheckoutSlot,
} from "@/lib/checkout";
import { bookingModeCopy, useCheckoutCopy } from "@/lib/checkout-copy";
import { useLocale } from "@/components/shell/locale-provider";

export function CheckoutFlow() {
  const copy = useCheckoutCopy();
  const { locale } = useLocale();
  const params = useSearchParams();
  const slug = params.get("listing") ?? "";
  const source = params.get("source") === "itinerary" ? "itinerary" : "listing";
  const stopId = params.get("stop") ?? undefined;
  const [party, setParty] = React.useState(2);
  const [slots, setSlots] = React.useState<CheckoutSlot[]>([]);
  const [mode, setMode] = React.useState("request");
  const [slotId, setSlotId] = React.useState("");
  const [quote, setQuote] = React.useState<CheckoutQuote | null>(null);
  const [bookingId, setBookingId] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("Do you have space this weekend?");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!slug) {
      return;
    }
    void fetchSlots(slug)
      .then((row) => {
        setMode(row.effective_mode);
        setSlots(row.slots);
        if (row.slots[0]) {
          setSlotId(row.slots[0].id);
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : copy.capacityGone));
  }, [copy.capacityGone, slug]);

  async function onQuote() {
    if (!slug || !slotId) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      setQuote(await quoteCheckout({ listing_slug: slug, slot_id: slotId, party_size: party }));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.capacityGone);
    } finally {
      setPending(false);
    }
  }

  async function onCommit() {
    if (!quote) {
      return;
    }
    setPending(true);
    try {
      const key = `web-${crypto.randomUUID()}`;
      const booking = await commitCheckout({ ...quote, listing_slug: slug, trip_stop_id: stopId }, key);
      setBookingId(booking.id);
      if (booking.payment_required && booking.status === "pending") {
        await payCheckout(booking.id, `pay-${crypto.randomUUID()}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.capacityGone);
    } finally {
      setPending(false);
    }
  }

  async function onInquiry() {
    setPending(true);
    try {
      await sendInquiry({ listing_slug: slug, party_size: party, message });
      setBookingId("inquiry");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.capacityGone);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-[390px] gap-4 px-4">
      <BookingGate />
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{source === "itinerary" ? copy.fromItinerary : copy.fromListing}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm font-medium">
            {copy.modeVisible}: {bookingModeCopy(quote?.effective_mode ?? mode, locale)}
          </p>
          <p className="text-sm text-text-muted">
            {mode === "inquiry" ? copy.inquiry : mode === "instant" ? copy.confirmedNote : copy.requestNote}
          </p>
          <p className="text-sm text-text-muted">{copy.suggestionNote}</p>
          <div className="grid gap-2">
            <Label htmlFor="party">{copy.party}</Label>
            <Input
              id="party"
              type="number"
              min={1}
              max={20}
              value={party}
              onChange={(event) => setParty(Number(event.target.value) || 1)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slot">{copy.date}</Label>
            <select
              id="slot"
              className="rounded-md border border-border bg-surface p-2 text-sm"
              value={slotId}
              onChange={(event) => setSlotId(event.target.value)}
            >
              {slots.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.starts_at} · {slot.remaining}
                </option>
              ))}
            </select>
          </div>
          {mode === "inquiry" ? (
            <div className="grid gap-2">
              <Label htmlFor="inquiry">{copy.inquiryMessage}</Label>
              <Input id="inquiry" value={message} onChange={(event) => setMessage(event.target.value)} />
              <Button type="button" disabled={pending} onClick={() => void onInquiry()}>
                {copy.sendInquiry}
              </Button>
            </div>
          ) : (
            <Button type="button" disabled={pending || !slotId} onClick={() => void onQuote()}>
              {copy.review}
            </Button>
          )}
          {quote ? (
            <section className="grid gap-2 rounded-card border border-border p-3 text-sm">
              <p>
                {copy.price}: {quote.total_minor} {quote.currency}
              </p>
              <p>
                {copy.policy}: {String(quote.policy_snapshot.terms ?? "")}
              </p>
              <Button type="button" disabled={pending} onClick={() => void onCommit()}>
                {quote.payment_required ? copy.pay : copy.commit}
              </Button>
            </section>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          {bookingId && bookingId !== "inquiry" ? (
            <Button asChild variant="outline">
              <LocaleLink href={`/bookings/${bookingId}`}>{copy.retrieve}</LocaleLink>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
