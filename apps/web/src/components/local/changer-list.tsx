"use client";

import * as React from "react";
import { ArrowUpRight, Banknote, Flag, Loader2, Phone } from "lucide-react";
import { LocateButton } from "@/components/guide/pickers";
import { SignInLink, useDay, useSignedIn } from "@/components/local/shared";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/components/partners/step";
import { TrustBadge } from "@/components/verified/what-we-checked";
import { interpolate } from "@/i18n/catalogues";
import {
  WEEKDAYS,
  distanceMetres,
  rateIsFresh,
  reportExchange,
  type Branch,
  type ExchangeReportCategory,
  type OpeningHours,
} from "@/lib/exchange";
import { beirutDateTime } from "@/lib/local-time";
import { useLocalCopy, type LocalCopy, type LocalKey } from "@/lib/local-copy";
import { usePartnerCopy } from "@/lib/partner-copy";

const CATEGORIES: ExchangeReportCategory[] = ["rate_different", "counterfeit", "refused_receipt", "conduct", "other"];

/** Today's opening hours on Beirut's clock, "09:00–13:00, 15:00–18:00", or null when closed. */
export function hoursToday(hours: OpeningHours, now = new Date()): string | null {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Beirut", weekday: "short" })
    .format(now)
    .toLowerCase()
    .slice(0, 3);
  const day = WEEKDAYS.find((value) => value === weekday);
  const spans = day ? hours[day] : undefined;
  if (!spans || spans.length === 0) {
    return null;
  }
  return spans.map(([open, close]) => `${open}–${close}`).join(", ");
}

export function distanceText(metres: number, copy: LocalCopy, locale: string): string {
  return metres < 1000
    ? interpolate(copy.distanceM, { m: String(Math.round(metres / 10) * 10) })
    : interpolate(copy.distanceKm, { km: (metres / 1000).toLocaleString(locale, { maximumFractionDigits: 1 }) });
}

function ReportForm({ officeId, onDone }: { officeId: string; onDone: (escalated: boolean) => void }) {
  const copy = useLocalCopy();
  const partner = usePartnerCopy();
  const [category, setCategory] = React.useState<ExchangeReportCategory>("rate_different");
  const [details, setDetails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await reportExchange(officeId, category, details.trim());
      onDone(result.escalated);
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 rounded-control bg-surface-sunken p-3" onSubmit={(event) => void send(event)}>
      <div className="grid gap-1.5">
        <Label htmlFor={`exch-cat-${officeId}`}>{copy.flagReason}</Label>
        <NativeSelect
          id={`exch-cat-${officeId}`}
          value={category}
          onChange={(event) => setCategory(event.target.value as ExchangeReportCategory)}
        >
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {copy[`exch_${value}` as LocalKey]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {category === "counterfeit" ? <p className="text-sm text-text-muted">{copy.counterfeitNote}</p> : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`exch-details-${officeId}`}>{partner.reportDetails}</Label>
        <Textarea
          id={`exch-details-${officeId}`}
          rows={3}
          minLength={10}
          maxLength={4000}
          required
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Button type="submit" size="sm" className="w-fit" disabled={busy || details.trim().length < 10}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {copy.sendFlag}
      </Button>
    </form>
  );
}

function BranchCard({ branch, distance }: { branch: Branch; distance: number | null }) {
  const copy = useLocalCopy();
  const { locale } = useLocale();
  const day = useDay();
  const signedIn = useSignedIn();
  const [reporting, setReporting] = React.useState(false);
  const [reported, setReported] = React.useState(false);
  const rates = branch.rates.filter((rate) => rateIsFresh(rate.posted_at));
  const today = hoursToday(branch.hours);
  const amount = (value: number) => interpolate(copy.lbp, { amount: value.toLocaleString(locale) });

  return (
    <article className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <h4 className="font-semibold">{branch.changer.display_name}</h4>
          <p className="text-sm text-text-muted">
            {branch.branch_name} · {branch.address}
          </p>
          {distance !== null ? <p className="text-sm font-medium">{distanceText(distance, copy, locale)}</p> : null}
        </div>
        <TrustBadge level={branch.changer.trust.level} />
      </div>
      <ul className="grid gap-0.5 text-xs text-text-muted">
        {branch.changer.bdl_number ? (
          <li>
            {interpolate(copy.bdlLine, { number: branch.changer.bdl_number, category: branch.changer.category ?? "" })}
            {branch.changer.register_checked_on
              ? ` · ${interpolate(copy.registerChecked, { date: day(branch.changer.register_checked_on) })}`
              : null}
          </li>
        ) : null}
        {branch.checked_on ? <li>{interpolate(copy.branchChecked, { date: day(branch.checked_on) })}</li> : null}
      </ul>
      {rates.length ? (
        <div className="grid gap-2">
          <dl className="grid gap-2 sm:grid-cols-2">
            {rates.map((rate) => (
              <div key={rate.base} className="grid gap-1 rounded-control bg-surface-sunken px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt>{interpolate(copy.theyBuy, { base: rate.base })}</dt>
                  <dd className="font-semibold tabular-nums">{amount(rate.buy)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>{interpolate(copy.theySell, { base: rate.base })}</dt>
                  <dd className="font-semibold tabular-nums">{amount(rate.sell)}</dd>
                </div>
              </div>
            ))}
          </dl>
          <p className="text-xs text-text-muted">
            {interpolate(copy.ratePosted, { time: beirutDateTime(locale, rates[0]?.posted_at ?? "") })}
          </p>
        </div>
      ) : (
        <p className="text-sm text-text-muted">{copy.noRate}</p>
      )}
      <p className="text-sm">{today ? interpolate(copy.openToday, { hours: today }) : copy.closedToday}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${branch.lat},${branch.lng}`}
            target="_blank"
            rel="noreferrer"
          >
            {copy.directions}
            <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
          </a>
        </Button>
        {branch.phone ? (
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${branch.phone.replace(/\s+/g, "")}`}>
              <Phone aria-hidden />
              {copy.callBranch}
            </a>
          </Button>
        ) : null}
        {!reported && !reporting ? (
          signedIn ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setReporting(true)}>
              <Flag className="size-3.5" aria-hidden />
              {copy.flagCard}
            </Button>
          ) : (
            <SignInLink label={copy.flagCard} className="text-text-muted" />
          )
        ) : null}
      </div>
      {reporting && !reported ? (
        <ReportForm
          officeId={branch.id}
          onDone={() => {
            setReported(true);
            setReporting(false);
          }}
        />
      ) : null}
      {reported ? (
        <Notice tone="success" role="status">
          {copy.flagThanks}
        </Notice>
      ) : null}
    </article>
  );
}

/** Licensed changers in a destination; nearest first once the traveller shares where they are. */
export function ChangerList({ branches, name }: { branches: Branch[]; name: string }) {
  const copy = useLocalCopy();
  const [here, setHere] = React.useState<{ lat: number; lng: number } | null>(null);
  const rows = branches.map((branch) => ({ branch, distance: here ? distanceMetres(here, branch) : null }));
  if (here) {
    rows.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  return (
    <div className="grid gap-4">
      <p className="flex items-start gap-2 text-sm text-text-muted">
        <Banknote className="mt-0.5 size-4 shrink-0" aria-hidden />
        {copy.changersBody}
      </p>
      {branches.length === 0 ? (
        <p className="rounded-card bg-surface-sunken p-4 text-sm">{interpolate(copy.changersEmpty, { name })}</p>
      ) : (
        <>
          {branches.length > 1 ? <LocateButton onLocate={(lat, lng) => setHere({ lat, lng })} /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            {rows.map(({ branch, distance }) => (
              <BranchCard key={branch.id} branch={branch} distance={distance} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
