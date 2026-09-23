"use client";

import * as React from "react";
import { Banknote, Clock, Globe, Loader2, MapPin, Route, Send, Users } from "lucide-react";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideWorkCopy } from "@/lib/guide-work-copy";
import { requestTour, type PublicTour } from "@/lib/guide-work";
import type { PublicGuide } from "@/lib/guides";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `tour-${crypto.randomUUID()}`
    : `tour-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function TourPanel({ guide, tour }: { guide: PublicGuide; tour: PublicTour }) {
  const copy = useGuideWorkCopy();
  const { locale } = useLocale();
  const { user } = useAuth();
  const [slot, setSlot] = React.useState(tour.next_slots[0]?.id ?? "");
  const [party, setParty] = React.useState("2");
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // One key per intent: a double click or a retry is the same request, not two.
  const key = React.useRef(newKey());
  const amount = tour.price_minor ?? 0;
  const chosen = tour.next_slots.find((item) => item.id === slot);
  const maxParty = Math.max(1, Math.min(tour.max_party, chosen?.remaining ?? tour.max_party));

  async function onRequest(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestTour(tour.slug, slot, Number(party), key.current);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
      key.current = newKey();
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm md:grid-cols-[1fr_20rem] md:p-6">
      <div className="grid content-start gap-3">
        <h3 className="title-card">{tour.title}</h3>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {interpolate(copy.tourMinutes, { n: String(tour.duration_minutes) })}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden />
            {tour.max_party}
          </span>
          {tour.languages.length ? (
            <span className="inline-flex items-center gap-1">
              <Globe className="size-3.5" aria-hidden />
              {tour.languages.join(", ")}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 font-medium text-text">
            <Banknote className="size-3.5" aria-hidden />
            {amount > 0
              ? `${formatCurrency(locale, amount / 100, "USD")} ${
                  tour.price_unit === "group" ? copy.publicPerGroup : copy.publicPerPerson
                }`
              : copy.tourFree}
          </span>
        </p>
        <p className="whitespace-pre-line text-text">{tour.description}</p>
        {tour.meeting_point ? (
          <p className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
            <span>
              <span className="font-medium">{copy.publicMeeting}: </span>
              {tour.meeting_point}
            </span>
          </p>
        ) : null}
        {tour.route.length ? (
          <div className="grid gap-1.5 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Route className="size-4 text-text-muted" aria-hidden />
              {copy.publicRoute}
            </span>
            <ol className="flex flex-wrap gap-2">
              {tour.route.map((stop) => (
                <li key={stop.position}>
                  <LocaleLink href={`/experiences/${stop.slug}`}>
                    <Badge variant="outline">
                      {stop.position}. {stop.title}
                    </Badge>
                  </LocaleLink>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {tour.included ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{copy.tourIncluded}</dt>
              <dd className="whitespace-pre-line">{tour.included}</dd>
            </div>
          ) : null}
          {tour.bring ? (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{copy.tourBring}</dt>
              <dd className="whitespace-pre-line">{tour.bring}</dd>
            </div>
          ) : null}
          {tour.cancellation_terms ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-text-muted">{copy.tourCancellation}</dt>
              <dd className="whitespace-pre-line">{tour.cancellation_terms}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <form
        onSubmit={(event) => void onRequest(event)}
        className="grid h-fit gap-3 rounded-control border border-border-subtle bg-surface p-4"
        aria-label={copy.publicRequest}
      >
        <span className="text-sm font-medium">{copy.publicNextDates}</span>
        {sent ? (
          <Notice tone="success" role="status">
            {interpolate(copy.publicRequested, { name: guide.display_name })}
          </Notice>
        ) : tour.next_slots.length === 0 ? (
          <p className="text-sm text-text-muted">{copy.publicNoDates}</p>
        ) : (
          <>
            <NativeSelect
              aria-label={copy.publicNextDates}
              value={slot}
              onChange={(event) => setSlot(event.target.value)}
            >
              {tour.next_slots.map((item) => (
                <option key={item.id} value={item.id}>
                  {formatDate(locale, item.starts_at, { dateStyle: "medium", timeStyle: "short" })}
                </option>
              ))}
            </NativeSelect>
            <div className="grid gap-1.5">
              <Label htmlFor={`party-${tour.slug}`}>{copy.publicParty}</Label>
              <Input
                id={`party-${tour.slug}`}
                type="number"
                min={1}
                max={maxParty}
                value={party}
                onChange={(event) => setParty(event.target.value)}
              />
            </div>
            {error ? (
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
            ) : null}
            {user ? (
              <Button type="submit" disabled={pending || !slot}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                {pending ? copy.publicRequesting : copy.publicRequest}
              </Button>
            ) : (
              <Button asChild>
                <LocaleLink href={`/signin?next=${encodeURIComponent(`/guides/${guide.slug}`)}`}>
                  {copy.publicSignIn}
                </LocaleLink>
              </Button>
            )}
            {amount > 0 ? <p className="text-xs text-text-muted">{copy.publicPayOnDay}</p> : null}
          </>
        )}
      </form>
    </li>
  );
}

/** The tours on a guide's public page, each with its own request panel. */
export function PublicTours({ guide, tours }: { guide: PublicGuide; tours: PublicTour[] }) {
  const copy = useGuideWorkCopy();
  return (
    <section className="grid gap-4" aria-labelledby="guide-tours">
      <h2 id="guide-tours" className="title-section text-[1.35rem]">
        {copy.publicToursTitle}
      </h2>
      {tours.length ? (
        <ul className="grid gap-4">
          {tours.map((tour) => (
            <TourPanel key={tour.slug} guide={guide} tour={tour} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{copy.publicToursEmpty}</p>
      )}
    </section>
  );
}
