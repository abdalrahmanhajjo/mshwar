"use client";

import * as React from "react";
import { Banknote, Loader2, UserCheck, UserX } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { checkIn, recordPayment } from "@/lib/guide-workspace";
import { useGuideWorkspaceCopy, type GuideWorkspaceKey } from "@/lib/guide-workspace-copy";
import type { PaymentMethod, TourBooking } from "@/lib/tour-booking";

const METHODS: PaymentMethod[] = ["cash", "wallet", "card", "transfer", "other"];
const HOUR = 60 * 60 * 1000;

/** On the day: who came, and what the guide was paid. Open from an hour before the start. */
export function DayRecord({ booking, onChange }: { booking: TourBooking; onChange: (next: TourBooking) => void }) {
  const copy = useGuideWorkspaceCopy();
  const { locale } = useLocale();
  const [now] = React.useState(() => Date.now());
  const [amount, setAmount] = React.useState(() =>
    ((booking.paid_minor ?? booking.total_minor) / 100).toFixed(2).replace(/\.00$/, ""),
  );
  const [method, setMethod] = React.useState<PaymentMethod>(booking.paid_method ?? "cash");
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const startsAt = new Date(booking.starts_at).getTime();
  const endsAt = new Date(booking.ends_at).getTime();
  const open = now >= startsAt - HOUR;
  const canCheckIn = open && now <= endsAt + 24 * HOUR;
  const started = now >= startsAt;

  if (!["confirmed", "completed"].includes(booking.status)) {
    return null;
  }

  async function act(name: string, action: () => Promise<TourBooking>) {
    setPending(name);
    setError(null);
    try {
      onChange(await action());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(null);
    }
  }

  function onPay(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      setError(copy.paymentInvalid);
      return;
    }
    void act("pay", () => recordPayment(booking.id, Math.round(value * 100), method));
  }

  const money = (minor: number) => formatCurrency(locale, minor / 100, booking.currency, { maximumFractionDigits: 2 });

  return (
    <section
      aria-labelledby="day-record-title"
      className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5"
    >
      <h2 id="day-record-title" className="title-section text-[1.15rem]">
        {copy.dayTitle}
      </h2>
      {!open ? <p className="text-sm text-text-muted">{copy.dayNote}</p> : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      <div className="grid gap-2">
        {booking.checked_in_at ? (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <UserCheck className="size-4" aria-hidden />
            {interpolate(copy.checkedInAt, {
              time: formatDate(locale, booking.checked_in_at, {
                dateStyle: undefined,
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Beirut",
              }),
            })}
          </p>
        ) : booking.no_show ? (
          <p className="flex items-center gap-2 text-sm font-medium text-danger">
            <UserX className="size-4" aria-hidden />
            {copy.markedNoShow}
          </p>
        ) : null}
        {canCheckIn ? (
          <div className="flex flex-wrap gap-2">
            {!booking.checked_in_at ? (
              <Button
                type="button"
                disabled={pending !== null}
                onClick={() => void act("in", () => checkIn(booking.id, "arrived"))}
              >
                {pending === "in" ? <Loader2 className="animate-spin" aria-hidden /> : <UserCheck aria-hidden />}
                {copy.arrived}
              </Button>
            ) : null}
            {started && !booking.no_show ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending !== null}
                onClick={() => void act("no-show", () => checkIn(booking.id, "no_show"))}
              >
                <UserX aria-hidden />
                {copy.markNoShow}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {open ? (
        <form
          className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-[10rem_14rem_auto]"
          onSubmit={onPay}
        >
          <p className="flex items-center gap-2 font-medium sm:col-span-3">
            <Banknote className="size-4 text-text-muted" aria-hidden />
            {copy.paymentTitle}
          </p>
          {booking.paid_minor !== null && booking.paid_minor !== undefined && booking.paid_method ? (
            <p className="text-sm text-success sm:col-span-3" role="status">
              {interpolate(copy.paymentSaved, {
                amount: money(booking.paid_minor),
                method: copy[`method${booking.paid_method}` as GuideWorkspaceKey],
              })}
            </p>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="paid-amount">{copy.paymentAmount}</Label>
            <Input
              id="paid-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="paid-method">{copy.paymentMethod}</Label>
            <NativeSelect
              id="paid-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {METHODS.map((item) => (
                <option key={item} value={item}>
                  {copy[`method${item}` as GuideWorkspaceKey]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="outline" disabled={pending !== null}>
              {pending === "pay" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {copy.paymentSave}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
