"use client";

import * as React from "react";
import { CalendarCheck2, ChevronLeft, ChevronRight, Clock, Loader2, Lock, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { languageName } from "@/lib/place-search";
import {
  bookTour,
  fetchAvailabilityMonth,
  monthCells,
  monthOf,
  newBookingKey,
  quoteTotal,
  shiftMonth,
  type AvailabilityMonth,
  type AvailableStart,
  type PublicTourPage,
  type TourBooking,
} from "@/lib/tour-booking";
import { useTourBookingCopy, type TourBookingKey } from "@/lib/tour-booking-copy";
import { cn, focusRing } from "@/lib/utils";

const BEIRUT = "Asia/Beirut";

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="grid gap-3">
      <h2 id={`step-${n}`} className="flex items-center gap-2.5 text-base font-semibold">
        <span className="grid size-7 place-items-center rounded-full bg-brand text-sm text-brand-foreground">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Counter({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Math.max(min, Math.min(max, Math.floor(Number(event.target.value) || 0))))}
        className="tabular-nums"
      />
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

/** Choose a date, a time, who is coming and any extras; see the total and the policy; book. */
export function TourBookingFlow({ tour }: { tour: PublicTourPage }) {
  const copy = useTourBookingCopy();
  const { locale } = useLocale();
  const { user } = useAuth();
  // Open on the month of the next bookable start, so the first view is never empty.
  const [month, setMonth] = React.useState(() => monthOf(tour.next_start ? new Date(tour.next_start) : new Date()));
  const [data, setData] = React.useState<AvailabilityMonth | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [day, setDay] = React.useState<string | null>(null);
  const [start, setStart] = React.useState<AvailableStart | null>(null);
  const [adults, setAdults] = React.useState(Math.max(1, tour.min_party));
  const [children, setChildren] = React.useState(0);
  const [language, setLanguage] = React.useState("");
  const [addons, setAddons] = React.useState<string[]>([]);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<TourBooking | null>(null);
  const key = React.useRef(newBookingKey());

  React.useEffect(() => {
    let cancelled = false;
    fetchAvailabilityMonth(tour.slug, month)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tour.slug, month]);

  const money = (minor: number) =>
    minor === 0
      ? copy.free
      : formatCurrency(locale, minor / 100, "USD", { maximumFractionDigits: minor % 100 ? 2 : 0 });
  const time = (iso: string) =>
    formatDate(locale, iso, { dateStyle: undefined, hour: "2-digit", minute: "2-digit", timeZone: BEIRUT });
  const longDate = (iso: string) =>
    formatDate(locale, iso, {
      dateStyle: undefined,
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: BEIRUT,
    });

  const days = new Map((data?.days ?? []).map((row) => [row.date, row]));
  const starts = day ? (days.get(day)?.starts ?? []) : [];
  const priceMinor = tour.price_minor ?? 0;
  const priceUnit = tour.price_unit ?? "person";
  const chosenAddons = tour.booking.addons.filter((addon) => addons.includes(addon.id));
  const party = adults + children;
  const maxParty = Math.min(tour.max_party, start?.remaining ?? tour.max_party);
  const quote = quoteTotal({
    priceMinor,
    priceUnit,
    childPriceMinor: tour.booking.child_price_minor,
    adults,
    children,
    addons: chosenAddons,
  });
  const freeUntil = start
    ? new Date(new Date(start.starts_at).getTime() - tour.booking.free_cancel_hours * 3600 * 1000).toISOString()
    : null;
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    formatDate(locale, `2024-01-0${i + 1}T12:00:00Z`, { dateStyle: undefined, weekday: "narrow" }),
  );

  async function onBook() {
    if (!start) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const booking = await bookTour(
        tour.slug,
        { slot_id: start.id, adults, children, language: language || null, addons, note: note.trim() },
        key.current,
      );
      setDone(booking);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
      key.current = newBookingKey();
    } finally {
      setPending(false);
    }
  }

  if (done) {
    const confirmed = done.status === "confirmed";
    return (
      <div className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-6 text-center shadow-sm">
        <CalendarCheck2 className="mx-auto size-10 text-success" aria-hidden />
        <h2 className="title-section text-[1.35rem]">{confirmed ? copy.confirmedTitle : copy.requestedTitle}</h2>
        <p className="text-text-muted">{longDate(done.starts_at)}</p>
        <p className="grid gap-1">
          <span className="text-xs uppercase tracking-[0.14em] text-text-muted">{copy.codeLabel}</span>
          <span className="font-mono text-2xl font-semibold tracking-wider" data-testid="booking-code">
            {done.code}
          </span>
        </p>
        {!confirmed && done.response_due_at ? (
          <p className="text-sm">{interpolate(copy.replyBy, { date: longDate(done.response_due_at) })}</p>
        ) : null}
        <div>
          <Button asChild>
            <LocaleLink href={`/tour-bookings/${done.id}`}>{copy.viewBooking}</LocaleLink>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="grid gap-8">
        <Step n={1} title={copy.stepDate}>
          <div className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={copy.prevMonth}
                disabled={month <= monthOf(new Date())}
                onClick={() => {
                  setMonth(shiftMonth(month, -1));
                  setDay(null);
                  setStart(null);
                }}
              >
                <ChevronLeft className="rtl:rotate-180" aria-hidden />
              </Button>
              <span className="font-semibold">
                {formatDate(locale, `${month}-15T12:00:00Z`, { dateStyle: undefined, month: "long", year: "numeric" })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                aria-label={copy.nextMonth}
                disabled={month >= shiftMonth(monthOf(new Date()), 4)}
                onClick={() => {
                  setMonth(shiftMonth(month, 1));
                  setDay(null);
                  setStart(null);
                }}
              >
                <ChevronRight className="rtl:rotate-180" aria-hidden />
              </Button>
            </div>
            {loadFailed ? (
              <Notice tone="danger" role="alert">
                {copy.loadError}
              </Notice>
            ) : !data ? (
              <Loader2 className="mx-auto size-5 animate-spin text-text-muted" aria-hidden />
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted" aria-hidden>
                  {weekdayLabels.map((label, index) => (
                    <span key={index}>{label}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1" role="group" aria-label={copy.stepDate}>
                  {monthCells(month).map((cell, index) => {
                    if (!cell) {
                      return <span key={`blank-${index}`} />;
                    }
                    const open = days.get(cell);
                    return (
                      <button
                        key={cell}
                        type="button"
                        disabled={!open}
                        aria-pressed={day === cell}
                        aria-label={
                          open
                            ? `${formatDate(locale, `${cell}T12:00:00Z`, { dateStyle: "full" })}, ${interpolate(copy.fromPrice, { price: money(open.from_minor ?? 0) })}`
                            : formatDate(locale, `${cell}T12:00:00Z`, { dateStyle: "full" })
                        }
                        onClick={() => {
                          setDay(cell);
                          setStart(open?.starts.length === 1 ? open.starts[0] : null);
                        }}
                        className={cn(
                          "grid min-h-12 place-items-center rounded-control border text-sm tabular-nums transition-colors",
                          open
                            ? "border-border-subtle bg-surface hover:border-brand"
                            : "border-transparent text-text-muted/50",
                          day === cell && "border-brand bg-brand text-brand-foreground hover:border-brand",
                          focusRing,
                        )}
                      >
                        <span className="font-medium">{Number(cell.slice(8))}</span>
                        {open ? <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
                {data.days.length === 0 ? <p className="text-sm text-text-muted">{copy.noDates}</p> : null}
              </>
            )}
          </div>
        </Step>

        <Step n={2} title={copy.stepTime}>
          {!day ? (
            <p className="text-sm text-text-muted">{copy.pickDay}</p>
          ) : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={copy.stepTime}>
              {starts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={start?.id === item.id}
                  onClick={() => setStart(item)}
                  className={cn(
                    "grid gap-0.5 rounded-control border px-4 py-2.5 text-start transition-colors",
                    start?.id === item.id
                      ? "border-brand bg-brand-subtle"
                      : "border-border-subtle bg-surface-raised hover:border-brand",
                    focusRing,
                  )}
                >
                  <span className="flex items-center gap-1.5 font-semibold tabular-nums">
                    <Clock className="size-4 text-brand" aria-hidden />
                    {time(item.starts_at)}
                  </span>
                  <span className="text-xs text-text-muted">
                    {item.private ? copy.privateStart : interpolate(copy.seatsLeft, { n: String(item.remaining) })}
                  </span>
                  {item.min_group > 1 ? (
                    <span className="text-xs text-text-muted">
                      {interpolate(copy.minGroup, { n: String(item.min_group) })}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </Step>

        <Step n={3} title={copy.stepGuests}>
          <div className="grid items-start gap-4 sm:grid-cols-2">
            <Counter
              id="adults"
              label={copy.adults}
              value={adults}
              min={1}
              max={Math.max(1, maxParty - children)}
              onChange={setAdults}
            />
            <Counter
              id="children"
              label={copy.children}
              hint={
                tour.booking.child_price_minor !== null && tour.booking.child_age_max
                  ? interpolate(copy.childrenUpTo, {
                      age: String(tour.booking.child_age_max),
                      price: money(tour.booking.child_price_minor),
                    })
                  : copy.childrenAdultPrice
              }
              value={children}
              min={0}
              max={Math.max(0, maxParty - adults)}
              onChange={setChildren}
            />
            {tour.languages.length > 1 ? (
              <div className="grid gap-1.5">
                <Label htmlFor="language">{copy.language}</Label>
                <NativeSelect id="language" value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option value="">{copy.languageAny}</option>
                  {tour.languages.map((code) => (
                    <option key={code} value={code}>
                      {languageName(code, locale)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </div>
          {tour.booking.addons.length ? (
            <fieldset className="grid gap-2">
              <legend className="pb-1 text-sm font-medium">{copy.extras}</legend>
              {tour.booking.addons.map((addon) => (
                <label
                  key={addon.id}
                  className="flex items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface-raised px-3 py-2.5 text-sm"
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={addons.includes(addon.id)}
                      onChange={(event) =>
                        setAddons((current) =>
                          event.target.checked ? [...current, addon.id] : current.filter((id) => id !== addon.id),
                        )
                      }
                    />
                    {addon.name}
                  </span>
                  <span className="text-text-muted tabular-nums">
                    {interpolate(addon.unit === "person" ? copy.perPerson : copy.perBooking, {
                      price: money(addon.price_minor),
                    })}
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="note">{copy.note}</Label>
            <Textarea
              id="note"
              maxLength={1000}
              rows={3}
              placeholder={copy.notePlaceholder}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </Step>
      </div>

      <aside
        aria-labelledby="summary-title"
        className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm lg:sticky lg:top-24"
      >
        <h2 id="summary-title" className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-full bg-brand text-sm text-brand-foreground">4</span>
          {copy.stepReview}
        </h2>
        <p className="font-medium">{tour.title}</p>
        {start ? <p className="text-sm text-text-muted">{longDate(start.starts_at)}</p> : null}
        <dl className="grid gap-1.5 text-sm">
          {priceUnit === "person" ? (
            <>
              <div className="flex justify-between gap-3">
                <dt>{interpolate(copy.lineAdults, { n: String(adults) })}</dt>
                <dd className="tabular-nums">{money(adults * priceMinor)}</dd>
              </div>
              {children ? (
                <div className="flex justify-between gap-3">
                  <dt>{interpolate(copy.lineChildren, { n: String(children) })}</dt>
                  <dd className="tabular-nums">{money(children * (tour.booking.child_price_minor ?? priceMinor))}</dd>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex justify-between gap-3">
              <dt>
                {copy.lineGroup} ({party})
              </dt>
              <dd className="tabular-nums">{money(priceMinor)}</dd>
            </div>
          )}
          {chosenAddons.map((addon) => (
            <div key={addon.id} className="flex justify-between gap-3">
              <dt>{addon.name}</dt>
              <dd className="tabular-nums">{money(addon.price_minor * (addon.unit === "person" ? party : 1))}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-3 border-t border-border-subtle pt-2 text-base font-semibold">
            <dt>{copy.total}</dt>
            <dd className="tabular-nums" data-testid="booking-total">
              {money(quote.totalMinor)}
            </dd>
          </div>
        </dl>
        <ul className="grid gap-2 text-sm">
          <li className="flex items-start gap-2">
            <Lock className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            {copy.paidOnDay}
          </li>
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            {tour.booking.instant_booking
              ? copy.instant
              : interpolate(copy.request, { n: String(tour.booking.request_ttl_hours) })}
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>
              {copy[`policy${tour.booking.policy}` as TourBookingKey]}
              {freeUntil ? (
                <span className="block text-text-muted">
                  {interpolate(copy.freeUntil, { date: longDate(freeUntil) })}
                </span>
              ) : null}
            </span>
          </li>
        </ul>
        {tour.booking.instant_booking ? <Badge variant="success">{copy.instant}</Badge> : null}
        {error ? (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        ) : null}
        {user ? (
          <Button type="button" disabled={!start || pending || party > maxParty} onClick={() => void onBook()}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? copy.booking : tour.booking.instant_booking ? copy.bookNow : copy.sendRequest}
          </Button>
        ) : (
          <Button asChild>
            <LocaleLink href={`/signin?next=${encodeURIComponent(`/tours/${tour.slug}/book`)}`}>
              {copy.signIn}
            </LocaleLink>
          </Button>
        )}
      </aside>
    </div>
  );
}
