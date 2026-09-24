"use client";

import * as React from "react";
import { Loader2, Phone, Route } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { RideReport } from "@/components/partners/ride-report";
import { RideSummary } from "@/components/partners/ride-summary";
import { errorText } from "@/components/partners/step";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency } from "@/i18n/format";
import { usePartnerCopy, type PartnerKey } from "@/lib/partner-copy";
import { cancelRide, fetchDriverRides, finishRide, reviewRide, type Ride } from "@/lib/rides";
import { useVerifiedCopy } from "@/lib/verified-copy";
import { useNow } from "@/lib/use-now";

/** 1–5 stars as radio buttons, then a few optional words. Shared by both sides of a ride. */
export function ReviewForm({
  onSend,
  label,
}: {
  onSend: (rating: number, body: string) => Promise<void>;
  label: string;
}) {
  const copy = usePartnerCopy();
  const [rating, setRating] = React.useState(0);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const id = React.useId();
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        void onSend(rating, body.trim()).finally(() => setBusy(false));
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">{label}</legend>
        <div className="flex gap-2" role="radiogroup" aria-label={copy.rating}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="inline-flex items-center gap-1 text-sm">
              <input
                type="radio"
                name={`${id}-rating`}
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-body`}>{copy.reviewBody}</Label>
        <Textarea
          id={`${id}-body`}
          rows={2}
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>
      <Button type="submit" className="w-fit" disabled={busy || rating === 0}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {copy.sendReview}
      </Button>
    </form>
  );
}

function RideRow({ ride, onChange }: { ride: Ride; onChange: (next: Ride) => void }) {
  const now = useNow();
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { locale } = useLocale();
  const [cancelling, setCancelling] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const started = new Date(ride.request.starts_at).getTime() <= now;
  const price = formatCurrency(locale, ride.price_minor / 100, ride.currency);

  async function act(task: () => Promise<Ride>) {
    setBusy(true);
    setError(null);
    try {
      onChange({ ...ride, ...(await task()) });
      setCancelling(false);
    } catch (caught) {
      setError(errorText(caught, verified.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <RideSummary request={ride.request} />
        <Badge variant={ride.state === "confirmed" ? "success" : "outline"}>
          {copy[`state_${ride.state}` as PartnerKey]}
        </Badge>
      </div>
      {ride.traveller ? (
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span>{interpolate(copy.traveller, { name: ride.traveller.display_name })}</span>
          {ride.traveller.phone ? (
            <a
              href={`tel:${ride.traveller.phone}`}
              dir="ltr"
              className="inline-flex items-center gap-1 font-medium underline"
            >
              <Phone className="size-3.5" aria-hidden />
              {interpolate(copy.call, { phone: ride.traveller.phone })}
            </a>
          ) : null}
        </p>
      ) : null}
      {ride.state === "confirmed" ? (
        <p className="text-sm font-medium">{interpolate(copy.collect, { price })}</p>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {ride.state === "confirmed" ? (
        <div className="flex flex-wrap gap-2">
          {started ? (
            <>
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void act(() => finishRide(ride.id, "completed"))}
              >
                {copy.finishDone}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void act(() => finishRide(ride.id, "no_show"))}
              >
                {copy.finishNoShow}
              </Button>
            </>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={() => setCancelling((value) => !value)}>
            {copy.cancelRide}
          </Button>
        </div>
      ) : null}
      {cancelling ? (
        <div className="grid gap-2">
          <Label htmlFor={`cancel-${ride.id}`}>{copy.cancelReason}</Label>
          <Textarea
            id={`cancel-${ride.id}`}
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="w-fit"
            disabled={busy || reason.trim().length < 5}
            onClick={() => void act(() => cancelRide(ride.id, reason.trim()))}
          >
            {copy.confirmCancel}
          </Button>
        </div>
      ) : null}
      {ride.state === "completed" ? (
        <div className="grid gap-2 border-t border-border-subtle pt-4 text-sm">
          {ride.reviews.mine ? <p>{interpolate(copy.yourReview, { n: String(ride.reviews.mine.rating) })}</p> : null}
          {ride.reviews.theirs ? (
            <p>
              {interpolate(copy.theirReview, { n: String(ride.reviews.theirs.rating) })} {ride.reviews.theirs.body}
            </p>
          ) : ride.reviews.mine ? (
            <p className="text-text-muted">{copy.reviewBlind}</p>
          ) : null}
          {ride.reviews.can_write ? (
            <ReviewForm
              label={copy.reviewTraveller}
              onSend={async (rating, body) => {
                try {
                  onChange({ ...ride, ...(await reviewRide(ride.id, rating, body)) });
                } catch (caught) {
                  setError(errorText(caught, verified.loadError));
                }
              }}
            />
          ) : null}
        </div>
      ) : null}
      <RideReport rideId={ride.id} />
    </li>
  );
}

/** /drive/rides: booked rides first, then the past ones. */
export function DriverRides() {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const [rides, setRides] = React.useState<Ride[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetchDriverRides()
      .then((rows) => {
        if (!cancelled) setRides(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const replace = (next: Ride) =>
    setRides((current) => (current ?? []).map((ride) => (ride.id === next.id ? next : ride)));
  const upcoming = (rides ?? []).filter((ride) => ride.state === "confirmed");
  const past = (rides ?? []).filter((ride) => ride.state !== "confirmed");

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow={copy.driveKicker} icon={<Route aria-hidden />} title={copy.ridesTitle} />
      {failed ? (
        <Notice tone="danger" role="alert">
          {verified.loadError}
        </Notice>
      ) : rides === null ? (
        <div className="grid place-items-center py-16 text-text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : rides.length === 0 ? (
        <EmptyState icon={<Route aria-hidden />} title={copy.ridesEmpty} />
      ) : (
        <>
          {upcoming.length ? (
            <section className="grid gap-3" aria-labelledby="upcoming-rides">
              <h2 id="upcoming-rides" className="title-section text-[1.15rem]">
                {copy.upcoming}
              </h2>
              <ul className="grid gap-4">
                {upcoming.map((ride) => (
                  <RideRow key={ride.id} ride={ride} onChange={replace} />
                ))}
              </ul>
            </section>
          ) : null}
          {past.length ? (
            <section className="grid gap-3" aria-labelledby="past-rides">
              <h2 id="past-rides" className="title-section text-[1.15rem]">
                {copy.past}
              </h2>
              <ul className="grid gap-4">
                {past.map((ride) => (
                  <RideRow key={ride.id} ride={ride} onChange={replace} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
