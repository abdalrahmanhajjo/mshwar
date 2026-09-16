"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { BookingGate } from "@/components/auth/booking-gate";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  CreditCard,
  Lock,
  MapPin,
  Send,
  ShieldCheck,
} from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/i18n/format";
import { getExperience } from "@/lib/catalog";
import { cn, focusRing } from "@/lib/utils";
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
    let current = true;
    void fetchSlots(slug)
      .then((row) => {
        if (!current) return;
        setMode(row.effective_mode);
        setSlots(row.slots);
        if (row.slots[0]) {
          setSlotId(row.slots[0].id);
        }
      })
      .catch((err: unknown) => current && setError(err instanceof Error ? err.message : copy.capacityGone));
    return () => {
      current = false;
    };
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

  const experience = slug ? getExperience(slug) : undefined;
  const step = bookingId ? 2 : quote ? 1 : 0;
  const steps = [copy.stepChoose, copy.stepReview, copy.stepDone];
  const money = (minor: number, currency = "USD") => formatCurrency(locale, minor / 100, currency);
  const time = (value: string) => formatDate(locale, value, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="grid gap-8">
      {experience ? (
        <LocaleLink
          href={`/experiences/${experience.slug}`}
          className={cn(
            "inline-flex w-fit items-center gap-2 rounded-sm text-sm text-text-muted hover:text-text",
            focusRing,
          )}
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {copy.backToListing}
        </LocaleLink>
      ) : null}
      <PageHeader
        eyebrow={copy.secureCheckout}
        icon={<ShieldCheck aria-hidden />}
        title={copy.title}
        description={source === "itinerary" ? copy.fromItinerary : copy.fromListing}
      />
      <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label={copy.title}>
        {steps.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              aria-current={index === step ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 font-medium",
                index < step && "border-transparent bg-brand-subtle text-text",
                index === step && "border-brand bg-brand text-brand-foreground",
                index > step && "border-border-subtle text-text-muted",
              )}
            >
              <span className="tabular-nums">
                {index < step ? <Check className="size-3.5" aria-hidden /> : index + 1}
              </span>
              {label}
            </span>
            {index < steps.length - 1 ? <span className="h-px w-6 bg-border-subtle" aria-hidden /> : null}
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="grid gap-6">
          <BookingGate />
          <section className="grid gap-6 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="title-card">{copy.modeVisible}</h2>
              <Badge variant="accent">{bookingModeCopy(quote?.effective_mode ?? mode, locale)}</Badge>
            </div>
            <Notice>
              <p>{mode === "inquiry" ? copy.inquiry : mode === "instant" ? copy.confirmedNote : copy.requestNote}</p>
              <p className="mt-1 text-xs">{copy.suggestionNote}</p>
            </Notice>
            <div className="grid gap-2 sm:max-w-xs">
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
              {slots.length ? (
                <NativeSelect id="slot" value={slotId} onChange={(event) => setSlotId(event.target.value)}>
                  {slots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {time(slot.starts_at)} · {slot.remaining}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <>
                  <NativeSelect id="slot" value={slotId} onChange={(event) => setSlotId(event.target.value)} disabled>
                    <option value="">—</option>
                  </NativeSelect>
                  <p className="text-sm text-text-muted">{copy.noSlots}</p>
                </>
              )}
            </div>
            {mode === "inquiry" ? (
              <div className="grid gap-3">
                <Label htmlFor="inquiry">{copy.inquiryMessage}</Label>
                <Textarea id="inquiry" rows={3} value={message} onChange={(event) => setMessage(event.target.value)} />
                <Button type="button" size="lg" disabled={pending} onClick={() => void onInquiry()}>
                  <Send aria-hidden />
                  {copy.sendInquiry}
                </Button>
              </div>
            ) : (
              <Button type="button" size="lg" disabled={pending || !slotId} onClick={() => void onQuote()}>
                {copy.review}
                <ArrowRight className="rtl:rotate-180" aria-hidden />
              </Button>
            )}
            {quote ? (
              <section className="grid gap-4 rounded-card border border-brand/30 bg-brand-subtle/40 p-5">
                <dl className="grid gap-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-text-muted">{copy.price}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{money(quote.total_minor, quote.currency)}</dd>
                  </div>
                  <div className="grid gap-1">
                    <dt className="text-text-muted">{copy.policy}</dt>
                    <dd>{String(quote.policy_snapshot.terms ?? "")}</dd>
                  </div>
                </dl>
                <Button
                  type="button"
                  size="lg"
                  variant={quote.payment_required ? "accent" : "default"}
                  disabled={pending}
                  onClick={() => void onCommit()}
                >
                  {quote.payment_required ? <CreditCard aria-hidden /> : <CalendarCheck aria-hidden />}
                  {quote.payment_required ? copy.pay : copy.commit}
                </Button>
              </section>
            ) : null}
            {error ? (
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
            ) : null}
            {bookingId ? (
              <Notice tone="success" icon={<CheckCircle2 aria-hidden />}>
                <p className="font-semibold">{bookingId === "inquiry" ? copy.sentInquiry : copy.bookingCreated}</p>
                {bookingId !== "inquiry" ? (
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <LocaleLink href={`/bookings/${bookingId}`}>{copy.retrieve}</LocaleLink>
                  </Button>
                ) : null}
              </Notice>
            ) : null}
          </section>
        </div>

        <aside
          aria-label={copy.summaryTitle}
          className="grid gap-5 overflow-hidden rounded-card border border-border-subtle bg-surface-raised shadow-md lg:sticky lg:top-24"
        >
          {experience ? (
            <div className="aspect-[16/9] overflow-hidden">
              <CatalogImage src={experience.image} alt={experience.imageAlt} />
            </div>
          ) : null}
          <div className="grid gap-5 px-6 pb-6 md:px-7 md:pb-7">
            <div className="grid gap-1">
              <p className="eyebrow">{copy.summaryTitle}</p>
              <h2 className="title-card text-[1.4rem]">{quote?.experience_title ?? experience?.title ?? slug}</h2>
              {experience ? (
                <p className="inline-flex items-center gap-1.5 text-sm text-text-muted">
                  <MapPin className="size-4" aria-hidden />
                  {experience.placeLabel}
                </p>
              ) : null}
            </div>
            <dl className="grid gap-3 border-t border-border-subtle pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">{copy.party}</dt>
                <dd className="font-medium tabular-nums">{party}</dd>
              </div>
              {quote ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">{copy.date}</dt>
                  <dd className="font-medium">{time(quote.starts_at)}</dd>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between gap-3 border-t border-border-subtle pt-3">
                <dt className="font-semibold">{copy.totalLabel}</dt>
                <dd className="text-2xl font-semibold tracking-tight tabular-nums">
                  {quote
                    ? money(quote.total_minor, quote.currency)
                    : experience
                      ? formatCurrency(locale, experience.priceFrom * party, "USD", { maximumFractionDigits: 0 })
                      : "—"}
                </dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 text-xs text-text-muted">
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {copy.testModeNote}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
