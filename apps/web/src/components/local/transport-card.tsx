"use client";

import * as React from "react";
import {
  Accessibility,
  Bus,
  Car,
  CarTaxiFront,
  Footprints,
  Flag,
  Loader2,
  Luggage,
  MoonStar,
  Ship,
  Smartphone,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { CheckedLine, SignInLink, useSignedIn } from "@/components/local/shared";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/components/partners/step";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency } from "@/i18n/format";
import { useLocalCopy, type LocalCopy, type LocalKey } from "@/lib/local-copy";
import { fareRange, flagTransportCard, type FlagReason, type TransportCard, type TransportMode } from "@/lib/transport";

const MODE_ICON: Record<TransportMode, LucideIcon> = {
  service_taxi: CarTaxiFront,
  taxi: CarTaxiFront,
  bus: Bus,
  van: Bus,
  ride_hailing: Smartphone,
  car_rental: Car,
  walking: Footprints,
  ferry: Ship,
};

const FLAG_REASONS: FlagReason[] = [
  "fare_higher",
  "fare_lower",
  "no_longer_runs",
  "wrong_pickup",
  "times_wrong",
  "unsafe",
  "other",
];

export function modeLabel(mode: TransportMode, copy: LocalCopy): string {
  return copy[`mode_${mode}` as LocalKey];
}

/** "USD 2–4 per person", "Free", or null when no fare was checked. */
export function fareText(
  card: Pick<TransportCard, "fare">,
  copy: LocalCopy,
  locale: Parameters<typeof formatCurrency>[0],
) {
  if (card.fare.basis === "free") {
    return copy.fareFree;
  }
  const range = fareRange(card);
  if (!range) {
    return null;
  }
  // Whole amounts read as "$2", not "$2.00"; LBP never shows piastres.
  const digits = (value: number) =>
    Number.isInteger(value) || range.currency === "LBP"
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const low = formatCurrency(locale, range.low, range.currency, digits(range.low));
  const fare =
    range.low === range.high ? low : `${low}–${formatCurrency(locale, range.high, range.currency, digits(range.high))}`;
  return interpolate(card.fare.basis === "vehicle" ? copy.fareVehicle : copy.farePerson, { fare });
}

function FlagForm({ cardId, onDone }: { cardId: string; onDone: () => void }) {
  const copy = useLocalCopy();
  const [reason, setReason] = React.useState<FlagReason>("fare_higher");
  const [details, setDetails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const reasonId = `flag-reason-${cardId}`;
  const detailsId = `flag-details-${cardId}`;

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await flagTransportCard(cardId, reason, details.trim());
      onDone();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 rounded-control bg-surface-sunken p-3" onSubmit={(event) => void send(event)}>
      <div className="grid gap-1.5">
        <Label htmlFor={reasonId}>{copy.flagReason}</Label>
        <NativeSelect id={reasonId} value={reason} onChange={(event) => setReason(event.target.value as FlagReason)}>
          {FLAG_REASONS.map((value) => (
            <option key={value} value={value}>
              {copy[`flag_${value}` as LocalKey]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={detailsId}>{copy.flagDetails}</Label>
        <Textarea
          id={detailsId}
          rows={2}
          maxLength={1000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Button type="submit" size="sm" className="w-fit" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {copy.sendFlag}
      </Button>
    </form>
  );
}

/** One checked way of getting somewhere: mode, where to get on, fare, times, and when we checked. */
export function TransportCardView({ card, flaggable = true }: { card: TransportCard; flaggable?: boolean }) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const signedIn = useSignedIn();
  const [flagging, setFlagging] = React.useState(false);
  const [flagged, setFlagged] = React.useState(false);
  const Icon = MODE_ICON[card.mode];
  const fare = fareText(card, copy, locale);
  const tip = card.tips[locale] || card.tips.en || "";
  const { min, max } = card.duration;
  const duration =
    min !== null && max !== null && max > min
      ? interpolate(copy.durationRange, { min: String(min), max: String(max) })
      : min !== null
        ? interpolate(copy.durationOne, { min: String(min) })
        : null;
  const facts = [
    duration,
    card.frequency_minutes ? interpolate(copy.everyN, { n: String(card.frequency_minutes) }) : null,
    card.first_departure && card.last_departure
      ? interpolate(copy.firstLast, { first: card.first_departure.slice(0, 5), last: card.last_departure.slice(0, 5) })
      : null,
    card.runs_sunday === null ? null : card.runs_sunday ? copy.sundayYes : copy.sundayNo,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <article className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-subtle text-text">
          <Icon className="size-5" strokeWidth={1.6} aria-hidden />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h4 className="font-semibold">
            {modeLabel(card.mode, copy)}
            {card.line_name ? <span className="font-normal text-text-muted"> · {card.line_name}</span> : null}
          </h4>
          {card.from ? (
            <p className="text-sm text-text-muted">
              {card.from.name}{" "}
              <span aria-hidden className="inline-block rtl:rotate-180">
                →
              </span>{" "}
              {card.to.name}
            </p>
          ) : null}
          {/* On a phone the fare sits under the title so neither is squeezed. */}
          {fare ? <p className="text-sm font-semibold tabular-nums sm:hidden">{fare}</p> : null}
        </div>
        {fare ? (
          <p aria-hidden className="hidden shrink-0 text-end text-sm font-semibold tabular-nums sm:block">
            {fare}
          </p>
        ) : null}
      </div>
      <ul className="grid gap-1 text-sm">
        {card.pickup.name ? <li>{interpolate(copy.pickupAt, { place: card.pickup.name })}</li> : null}
        {card.dropoff.name ? <li>{interpolate(copy.dropoffAt, { place: card.dropoff.name })}</li> : null}
      </ul>
      {facts.length ? (
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-muted">
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
      ) : null}
      {tip ? <p className="whitespace-pre-line text-sm">{tip}</p> : null}
      {card.step_free || card.night_service || card.luggage_ok ? (
        <ul className="flex flex-wrap gap-2 text-xs">
          {card.step_free ? (
            <li className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken px-2.5 py-1">
              <Accessibility className="size-3.5" aria-hidden />
              {copy.stepFree}
            </li>
          ) : null}
          {card.night_service ? (
            <li className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken px-2.5 py-1">
              <MoonStar className="size-3.5" aria-hidden />
              {copy.nightService}
            </li>
          ) : null}
          {card.luggage_ok ? (
            <li className="inline-flex items-center gap-1 rounded-pill bg-surface-sunken px-2.5 py-1">
              <Luggage className="size-3.5" aria-hidden />
              {copy.luggageOk}
            </li>
          ) : null}
        </ul>
      ) : null}
      {card.safety_note ? (
        <p className="flex items-start gap-2 text-sm text-warning">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {card.safety_note}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CheckedLine checkedOn={card.checked_on} reviewBy={card.review_by} />
        {flaggable && !flagged && !flagging ? (
          signedIn ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFlagging(true)}>
              <Flag className="size-3.5" aria-hidden />
              {copy.flagCard}
            </Button>
          ) : (
            <SignInLink label={copy.flagCard} className="text-text-muted" />
          )
        ) : null}
      </div>
      {flagging && !flagged ? (
        <FlagForm
          cardId={card.id}
          onDone={() => {
            setFlagged(true);
            setFlagging(false);
          }}
        />
      ) : null}
      {flagged ? (
        <Notice tone="success" role="status">
          {copy.flagThanks}
        </Notice>
      ) : null}
    </article>
  );
}
