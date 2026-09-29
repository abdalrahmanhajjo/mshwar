"use client";

import * as React from "react";
import { ArrowRightLeft, CalendarClock, Loader2, MapPin, Receipt, Users, XCircle } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { respondGuideRequest } from "@/lib/guide-work";
import {
  answerReschedule,
  cancelTourBooking,
  fetchAvailabilityMonth,
  fetchGuideTourBooking,
  fetchMyTourBooking,
  monthOf,
  proposeReschedule,
  shiftMonth,
  type AvailableStart,
  type TourBooking,
} from "@/lib/tour-booking";
import { useTourBookingCopy, type TourBookingKey } from "@/lib/tour-booking-copy";

const BEIRUT = "Asia/Beirut";
type Role = "traveller" | "guide";

const TONE: Record<TourBooking["status"], "default" | "secondary" | "success" | "warning" | "danger" | "outline"> = {
  pending: "warning",
  confirmed: "success",
  rejected: "danger",
  cancelled: "outline",
  expired: "outline",
  completed: "secondary",
  refunded: "outline",
};

/** Other open starts of the same tour over the next two months, for a move. */
function useOtherStarts(booking: TourBooking | null, enabled: boolean) {
  const [starts, setStarts] = React.useState<AvailableStart[] | null>(null);
  React.useEffect(() => {
    if (!booking || !enabled) {
      return;
    }
    let cancelled = false;
    const first = monthOf(new Date());
    Promise.all([
      fetchAvailabilityMonth(booking.tour_slug, first),
      fetchAvailabilityMonth(booking.tour_slug, shiftMonth(first, 1)),
    ])
      .then((months) => {
        if (!cancelled) {
          setStarts(
            months
              .flatMap((month) => month.days.flatMap((day) => day.starts))
              .filter((start) => start.starts_at !== booking.starts_at && start.remaining >= booking.party_size),
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStarts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [booking, enabled]);
  return starts;
}

export function TourBookingView({ bookingId, role }: { bookingId: string; role: Role }) {
  const copy = useTourBookingCopy();
  const { locale } = useLocale();
  const [booking, setBooking] = React.useState<TourBooking | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [cancelling, setCancelling] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [moving, setMoving] = React.useState(false);
  const [target, setTarget] = React.useState("");
  const [message, setMessage] = React.useState("");
  // Read once: whether the start is still ahead does not need to tick while the page is open.
  const [now] = React.useState(() => Date.now());

  React.useEffect(() => {
    let cancelled = false;
    (role === "guide" ? fetchGuideTourBooking(bookingId) : fetchMyTourBooking(bookingId))
      .then((row) => {
        if (!cancelled) {
          setBooking(row);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setFailed(caught instanceof ApiError && caught.status === 404 ? copy.notFound : copy.loadError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, role, copy.notFound, copy.loadError]);

  const live = booking !== null && ["pending", "confirmed"].includes(booking.status);
  const future = booking !== null && new Date(booking.starts_at).getTime() > now;
  const otherStarts = useOtherStarts(booking, moving && live && future);

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {failed}
      </Notice>
    );
  }
  if (!booking) {
    return (
      <div className="grid place-items-center py-16 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  const money = (minor: number) =>
    minor === 0 ? copy.free : formatCurrency(locale, minor / 100, booking.currency, { maximumFractionDigits: 2 });
  const longDate = (iso: string) =>
    formatDate(locale, iso, {
      dateStyle: undefined,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: BEIRUT,
    });
  const late = booking.status === "confirmed" && now > new Date(booking.free_cancel_until).getTime();
  const proposal = booking.reschedule;

  async function run(label: string, action: () => Promise<TourBooking>) {
    setBusy(label);
    setError(null);
    try {
      setBooking(await action());
      setCancelling(false);
      setMoving(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setBusy(null);
    }
  }

  async function respond(status: "confirmed" | "rejected") {
    if (!booking) {
      return;
    }
    const why = status === "rejected" ? reason.trim() : "Accepted";
    if (status === "rejected" && why.length < 2) {
      setCancelling(true);
      return;
    }
    await run(status, async () => {
      await respondGuideRequest(booking.id, { status, reason: why });
      return fetchGuideTourBooking(booking.id);
    });
  }

  return (
    <div className="grid gap-6">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TONE[booking.status]}>{copy[`status${booking.status}` as TourBookingKey]}</Badge>
          <span className="font-mono text-sm tracking-wider text-text-muted">{booking.code}</span>
        </div>
        <h1 className="title-page text-[clamp(1.6rem,4vw,2.2rem)]">
          <LocaleLink href={`/tours/${booking.tour_slug}`} className="hover:underline">
            {booking.tour_title}
          </LocaleLink>
        </h1>
        <p className="text-text-muted">{interpolate(copy.byGuide, { name: booking.guide_name })}</p>
      </header>

      {booking.rescheduled_to ? (
        <Notice tone="info">
          {copy.movedTo}{" "}
          <LocaleLink
            className="font-semibold underline"
            href={
              role === "guide"
                ? `/guide/bookings/${booking.rescheduled_to}`
                : `/tour-bookings/${booking.rescheduled_to}`
            }
          >
            {copy.openNew}
          </LocaleLink>
        </Notice>
      ) : null}
      {booking.rescheduled_from ? <p className="text-sm text-text-muted">{copy.movedFrom}</p> : null}
      {booking.status === "cancelled" && booking.cancelled_by ? (
        <Notice tone="warning">
          {booking.cancelled_by === "guide" ? copy.cancelledByGuide : copy.cancelledByTraveller}
          {booking.late_cancellation ? ` · ${copy.lateNote}` : ""}
          {booking.reason ? <span className="block text-sm">{booking.reason}</span> : null}
        </Notice>
      ) : null}

      <dl className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 sm:grid-cols-2">
        <div className="grid gap-1">
          <dt className="flex items-center gap-1.5 text-sm text-text-muted">
            <CalendarClock className="size-4" aria-hidden />
            {copy.when}
          </dt>
          <dd className="font-medium">{longDate(booking.starts_at)}</dd>
          {booking.status === "pending" && booking.response_due_at ? (
            <dd className="text-sm text-text-muted">
              {interpolate(copy.replyBy, { date: longDate(booking.response_due_at) })}
            </dd>
          ) : null}
        </div>
        <div className="grid gap-1">
          <dt className="flex items-center gap-1.5 text-sm text-text-muted">
            <MapPin className="size-4" aria-hidden />
            {copy.meeting}
          </dt>
          <dd className="font-medium">{booking.meeting_point || "—"}</dd>
        </div>
        <div className="grid gap-1">
          <dt className="flex items-center gap-1.5 text-sm text-text-muted">
            <Users className="size-4" aria-hidden />
            {copy.guests}
          </dt>
          <dd className="font-medium">
            {interpolate(copy.lineAdults, { n: String(booking.adults) })}
            {booking.children ? ` · ${interpolate(copy.lineChildren, { n: String(booking.children) })}` : ""}
            {booking.private ? ` · ${copy.privateStart}` : ""}
          </dd>
        </div>
        <div className="grid gap-1">
          <dt className="flex items-center gap-1.5 text-sm text-text-muted">
            <Receipt className="size-4" aria-hidden />
            {copy.total}
          </dt>
          <dd className="font-semibold tabular-nums">{money(booking.total_minor)}</dd>
          {booking.addons.length ? (
            <dd className="text-sm text-text-muted">
              {booking.addons.map((addon) => `${addon.name} (${money(addon.total_minor)})`).join(" · ")}
            </dd>
          ) : null}
          <dd className="text-xs text-text-muted">{copy.paidOnDay}</dd>
        </div>
        <div className="grid gap-1 sm:col-span-2">
          <dt className="text-sm text-text-muted">{copy[`policy${booking.policy}` as TourBookingKey]}</dt>
          <dd className="text-sm">{interpolate(copy.freeUntil, { date: longDate(booking.free_cancel_until) })}</dd>
        </div>
        {booking.note ? (
          <div className="grid gap-1 sm:col-span-2">
            <dt className="text-sm text-text-muted">{copy.note}</dt>
            <dd className="whitespace-pre-line">{booking.note}</dd>
          </div>
        ) : null}
      </dl>

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {proposal && live ? (
        <section className="grid gap-3 rounded-card border border-brand/40 bg-brand-subtle p-5">
          <p className="flex items-center gap-2 font-medium">
            <ArrowRightLeft className="size-4 text-brand" aria-hidden />
            {proposal.by_role === role
              ? interpolate(copy.proposalMine, { date: longDate(proposal.new_starts_at) })
              : interpolate(proposal.by_role === "guide" ? copy.proposalFromGuide : copy.proposalFromTraveller, {
                  date: longDate(proposal.new_starts_at),
                })}
          </p>
          {proposal.message ? <p className="text-sm">“{proposal.message}”</p> : null}
          {proposal.by_role !== role ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy !== null}
                onClick={() => void run("accept-move", () => answerReschedule(booking.id, true))}
              >
                {busy === "accept-move" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {copy.accept}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void run("decline-move", () => answerReschedule(booking.id, false))}
              >
                {copy.decline}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {role === "guide" && booking.status === "pending" && future ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy !== null} onClick={() => void respond("confirmed")}>
            {busy === "confirmed" ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {copy.acceptRequest}
          </Button>
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void respond("rejected")}>
            {copy.declineRequest}
          </Button>
        </div>
      ) : null}

      {live && future ? (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setMoving((open) => !open)}>
              <ArrowRightLeft aria-hidden />
              {copy.reschedule}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setCancelling((open) => !open)}>
              <XCircle aria-hidden />
              {copy.cancel}
            </Button>
          </div>

          {moving ? (
            <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5">
              {otherStarts === null ? (
                <Loader2 className="size-5 animate-spin text-text-muted" aria-hidden />
              ) : otherStarts.length === 0 ? (
                <p className="text-sm text-text-muted">{copy.rescheduleNone}</p>
              ) : (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="move-to">{copy.stepTime}</Label>
                    <NativeSelect id="move-to" value={target} onChange={(event) => setTarget(event.target.value)}>
                      <option value="">—</option>
                      {otherStarts.map((start) => (
                        <option key={start.id} value={start.id}>
                          {longDate(start.starts_at)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="move-message">{copy.rescheduleMessage}</Label>
                    <Textarea
                      id="move-message"
                      rows={2}
                      maxLength={500}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                    />
                  </div>
                  <div>
                    <Button
                      type="button"
                      disabled={!target || busy !== null}
                      onClick={() => void run("move", () => proposeReschedule(booking.id, target, message.trim()))}
                    >
                      {busy === "move" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                      {copy.rescheduleSend}
                    </Button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {cancelling ? (
            <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5">
              {role === "traveller" && late ? <Notice tone="warning">{copy.cancelLate}</Notice> : null}
              <div className="grid gap-1.5">
                <Label htmlFor="cancel-reason">
                  {role === "guide" && booking.status === "pending" ? copy.declineReason : copy.cancelReason}
                </Label>
                <Textarea
                  id="cancel-reason"
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={reason.trim().length < 2 || busy !== null}
                  onClick={() => void run("cancel", () => cancelTourBooking(booking.id, reason.trim()))}
                >
                  {busy === "cancel" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {copy.cancelConfirm}
                </Button>
                {role === "guide" && booking.status === "pending" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={reason.trim().length < 2 || busy !== null}
                    onClick={() => void respond("rejected")}
                  >
                    {copy.declineRequest}
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
