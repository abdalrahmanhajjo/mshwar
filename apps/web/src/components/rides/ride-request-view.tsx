"use client";

import * as React from "react";
import { ArrowLeft, Check, Copy, Loader2, Phone, Share2 } from "lucide-react";
import { PartnerPhoto, vehicleText } from "@/components/local/driver-card";
import { money } from "@/components/local/shared";
import { ReviewForm } from "@/components/partners/driver-rides";
import { RideReport } from "@/components/partners/ride-report";
import { RideSummary } from "@/components/partners/ride-summary";
import { errorText } from "@/components/partners/step";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { TrustBadge, WhatWeChecked } from "@/components/verified/what-we-checked";
import { interpolate } from "@/i18n/catalogues";
import { beirutDateTime } from "@/lib/local-time";
import { useLocalCopy, type LocalKey } from "@/lib/local-copy";
import {
  acceptQuote,
  cancelRide,
  cancelRideRequest,
  fetchRideRequest,
  renewShareLink,
  reviewRide,
  shareUrl,
  type Quote,
  type Ride,
  type RideRequestDetail,
} from "@/lib/rides";

function QuoteCard({ quote, onAccept, busy }: { quote: Quote; onAccept: () => void; busy: boolean }) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const driver = quote.driver;
  const rating =
    driver.rating.count > 0 && driver.rating.average !== null
      ? interpolate(copy.ratingLine, {
          avg: driver.rating.average.toLocaleString(locale, { maximumFractionDigits: 1 }),
          count: String(driver.rating.count),
        })
      : copy.newDriver;
  return (
    <li className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <PartnerPhoto url={driver.photo_url} name={driver.display_name} />
        <div className="grid min-w-0 flex-1 gap-1">
          <LocaleLink href={`/drivers/${driver.slug}`} className="font-semibold underline-offset-4 hover:underline">
            {driver.display_name}
          </LocaleLink>
          <p className="text-sm text-text-muted">{rating}</p>
          <p className="text-sm text-text-muted">
            {interpolate(copy.quoteFor, {
              vehicle: vehicleText(quote.vehicle, copy.vehicleLine),
              seats: interpolate(copy.seatsN, { n: String(quote.vehicle.seats) }),
            })}
          </p>
        </div>
        <p className="text-xl font-semibold tabular-nums">{money(locale, quote.price_minor, quote.currency)}</p>
      </div>
      {quote.note ? (
        <p className="rounded-control bg-surface-sunken px-3 py-2 text-sm">
          <span className="font-medium">{copy.quoteNoteLabel}: </span>
          {quote.note}
        </p>
      ) : null}
      <WhatWeChecked trust={driver.trust} compact />
      <Button type="button" className="w-fit" disabled={busy} onClick={onAccept}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check aria-hidden />}
        {interpolate(copy.bookAt, { price: money(locale, quote.price_minor, quote.currency) })}
      </Button>
    </li>
  );
}

function ShareLink({
  rideId,
  token,
  onToken,
}: {
  rideId: string;
  token: string | null;
  onToken: (token: string) => void;
}) {
  const copy = useLocalCopy();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const url = token && typeof window !== "undefined" ? shareUrl(window.location.origin, token) : null;

  async function renew() {
    setBusy(true);
    setError(null);
    try {
      onToken((await renewShareLink(rideId)).share_token);
      setCopied(false);
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
      <h2 className="flex items-center gap-2 font-semibold">
        <Share2 className="size-4" aria-hidden />
        {copy.shareTitle}
      </h2>
      <p className="text-sm text-text-muted">{copy.shareBody}</p>
      {url ? (
        <>
          <Notice tone="info">{copy.shareOnce}</Notice>
          <div className="flex flex-wrap items-center gap-2">
            <code dir="ltr" className="min-w-0 flex-1 break-all rounded-control bg-surface-sunken px-3 py-2 text-xs">
              {url}
            </code>
            <Button type="button" size="sm" variant="outline" onClick={() => void copyUrl()}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? copy.copied : copy.copyLink}
            </Button>
          </div>
        </>
      ) : null}
      <div className="grid gap-1">
        <Button
          type="button"
          size="sm"
          variant={url ? "ghost" : "outline"}
          className="w-fit"
          disabled={busy}
          onClick={() => void renew()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {copy.newLink}
        </Button>
        {url ? null : <p className="text-xs text-text-muted">{copy.newLinkHint}</p>}
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
    </section>
  );
}

function BookedRide({
  ride,
  token,
  onToken,
  onChange,
}: {
  ride: Ride;
  token: string | null;
  onToken: (token: string) => void;
  onChange: (next: Ride) => void;
}) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const [cancelling, setCancelling] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const price = money(locale, ride.price_minor, ride.currency);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      onChange({ ...ride, ...(await cancelRide(ride.id, reason.trim())) });
      setCancelling(false);
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="title-section text-[1.3rem]">{copy.yourDriver}</h2>
          <Badge variant={ride.state === "confirmed" || ride.state === "completed" ? "success" : "outline"}>
            {copy[`tstate_${ride.state}` as LocalKey]}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <PartnerPhoto url={ride.driver.photo_url} name={ride.driver.display_name} className="size-16" />
          <div className="grid gap-1">
            <LocaleLink
              href={`/drivers/${ride.driver.slug}`}
              className="text-lg font-semibold underline-offset-4 hover:underline"
            >
              {ride.driver.display_name}
            </LocaleLink>
            <TrustBadge level={ride.driver.trust.level} className="w-fit" />
          </div>
        </div>
        <div className="grid gap-1 rounded-control border-2 border-brand bg-brand-subtle/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{copy.checkPlate}</p>
          <p dir="ltr" className="text-2xl font-bold tracking-wider">
            {ride.vehicle.plate}
          </p>
          <p className="text-sm">{vehicleText(ride.vehicle, copy.vehicleLine)}</p>
        </div>
        {ride.state === "confirmed" ? (
          <>
            {ride.driver_phone ? (
              <Button asChild variant="outline" className="w-fit">
                <a href={`tel:${ride.driver_phone}`} dir="ltr">
                  <Phone aria-hidden />
                  {interpolate(copy.callDriver, { phone: ride.driver_phone })}
                </a>
              </Button>
            ) : null}
            <p className="font-medium">{interpolate(copy.payInCar, { price })}</p>
          </>
        ) : null}
        {ride.state === "cancelled_by_driver" && ride.cancel_reason ? (
          <Notice tone="warning">{interpolate(copy.driverReason, { reason: ride.cancel_reason })}</Notice>
        ) : null}
        {error ? (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        ) : null}
        {ride.state === "confirmed" ? (
          cancelling ? (
            <div className="grid gap-2">
              <Label htmlFor={`cancel-${ride.id}`}>{copy.cancelReasonOptional}</Label>
              <Textarea
                id={`cancel-${ride.id}`}
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void cancel()}>
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {copy.confirmCancelRide}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setCancelling(false)}>
                  {copy.keepRide}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" size="sm" variant="ghost" className="w-fit" onClick={() => setCancelling(true)}>
              {copy.cancelRideTraveller}
            </Button>
          )
        ) : null}
      </section>

      {ride.state === "confirmed" ? <ShareLink rideId={ride.id} token={token} onToken={onToken} /> : null}

      {ride.state === "completed" ? (
        <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 text-sm md:p-5">
          {ride.reviews.mine ? <p>{interpolate(copy.yourReviewN, { n: String(ride.reviews.mine.rating) })}</p> : null}
          {ride.reviews.mine && !ride.reviews.theirs ? (
            <p className="text-text-muted">{copy.reviewBlindTraveller}</p>
          ) : null}
          {ride.reviews.can_write ? (
            <ReviewForm
              label={copy.reviewDriver}
              onSend={async (rating, body) => {
                try {
                  onChange({ ...ride, ...(await reviewRide(ride.id, rating, body)) });
                } catch (caught) {
                  setError(errorText(caught, copy.loadError));
                }
              }}
            />
          ) : null}
        </section>
      ) : null}

      <RideReport rideId={ride.id} />
    </div>
  );
}

/** /rides/[id]: a traveller's request, the prices drivers sent, and the ride once booked. */
export function RideRequestView({ requestId }: { requestId: string }) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const [detail, setDetail] = React.useState<RideRequestDetail | null | undefined>(undefined);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [version, setVersion] = React.useState(0);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [token, setToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchRideRequest(requestId)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setFailed(errorText(caught, copy.loadError));
      });
    return () => {
      cancelled = true;
    };
  }, [requestId, version, copy.loadError]);

  async function accept(quoteId: string) {
    setBusy(quoteId);
    setError(null);
    try {
      const ride = await acceptQuote(quoteId);
      if (ride.share_token) setToken(ride.share_token);
      setVersion((value) => value + 1);
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(null);
    }
  }

  async function cancelRequest() {
    setBusy("cancel");
    setError(null);
    try {
      await cancelRideRequest(requestId);
      setVersion((value) => value + 1);
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(null);
    }
  }

  const back = (
    <LocaleLink href="/rides" className="inline-flex w-fit items-center gap-2 text-sm text-text-muted hover:text-text">
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {copy.backToRides}
    </LocaleLink>
  );

  if (failed) {
    return (
      <div className="grid gap-4">
        {back}
        <Notice tone="danger" role="alert">
          {failed}
        </Notice>
      </div>
    );
  }
  if (!detail) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  const offered = detail.quotes.filter((quote) => quote.status === "offered");
  return (
    <div className="grid gap-6">
      {back}
      <PageHeader
        eyebrow={copy[`req_${detail.status}` as LocalKey]}
        title={detail.ride ? copy.rideTitle : copy.requestTitle}
        description={detail.destination.name}
      />
      <section className="rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
        <RideSummary request={detail} />
      </section>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {detail.ride ? (
        <BookedRide
          ride={detail.ride}
          token={token}
          onToken={setToken}
          onChange={(ride) => setDetail({ ...detail, ride })}
        />
      ) : detail.status === "open" ? (
        <div className="grid gap-4">
          <h2 className="title-section text-[1.3rem]">{copy.quotesTitle}</h2>
          {offered.length === 0 ? (
            <Notice tone="info" role="status">
              {copy.quotesWaiting}
            </Notice>
          ) : (
            <ul className="grid gap-4">
              {offered.map((quote) => (
                <QuoteCard key={quote.id} quote={quote} busy={busy !== null} onAccept={() => void accept(quote.id)} />
              ))}
            </ul>
          )}
          <p className="text-sm text-text-muted">
            {interpolate(copy.openUntil, { time: beirutDateTime(locale, detail.expires_at) })}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="w-fit"
            disabled={busy !== null}
            onClick={() => void cancelRequest()}
          >
            {copy.cancelRequest}
          </Button>
        </div>
      ) : (
        <Notice tone="info">{copy.requestClosed}</Notice>
      )}
    </div>
  );
}
