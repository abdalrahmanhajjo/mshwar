"use client";

import * as React from "react";
import { Loader2, Plus, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { ApiError } from "@/lib/api/client";
import type { GuideTour } from "@/lib/guide-work";
import { saveBookingSettings, type BookingSettingsInput, type CancellationPolicy } from "@/lib/tour-booking";
import { useTourBookingCopy, type TourBookingKey } from "@/lib/tour-booking-copy";

const POLICIES: CancellationPolicy[] = ["flexible", "moderate", "strict"];

type Row = { id?: string; name: string; price: string; unit: "person" | "booking" };

function toDollars(minor: number | null | undefined): string {
  return minor === null || minor === undefined ? "" : String(minor / 100);
}

function toMinor(value: string): number {
  const amount = Number(value.replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

/** The settings as the form holds them, turned into the body the API takes. */
export function settingsBody(state: {
  instant: boolean;
  ttl: number;
  policy: CancellationPolicy;
  childPrice: string;
  childAge: string;
  rows: Row[];
  host: boolean;
}): BookingSettingsInput {
  return {
    instant_booking: state.instant,
    request_ttl_hours: Math.min(48, Math.max(12, Math.round(state.ttl) || 24)),
    policy: state.policy,
    // A host charges nothing, so children are free like everyone else.
    child_price_minor: state.host || !state.childPrice.trim() ? null : toMinor(state.childPrice),
    child_age_max: state.childAge.trim() ? Math.min(17, Math.max(1, Math.round(Number(state.childAge)))) : null,
    addons: state.rows
      .filter((row) => row.name.trim().length >= 2)
      .map((row) => ({
        ...(row.id ? { id: row.id } : {}),
        name: row.name.trim(),
        price_minor: state.host ? 0 : toMinor(row.price),
        unit: row.unit,
      })),
  };
}

/** How one tour is booked: instant or request, the reply window, the policy, children and extras. */
export function BookingSettings({ tour }: { tour: GuideTour }) {
  const copy = useTourBookingCopy();
  const terms = tour.booking;
  const host = tour.tier === "host";
  const [instant, setInstant] = React.useState(terms?.instant_booking ?? false);
  const [ttl, setTtl] = React.useState(terms?.request_ttl_hours ?? 24);
  const [policy, setPolicy] = React.useState<CancellationPolicy>(terms?.policy ?? "flexible");
  const [childPrice, setChildPrice] = React.useState(toDollars(terms?.child_price_minor));
  const [childAge, setChildAge] = React.useState(terms?.child_age_max ? String(terms.child_age_max) : "");
  const [rows, setRows] = React.useState<Row[]>(
    (terms?.addons ?? []).map((addon) => ({
      id: addon.id,
      name: addon.name,
      price: toDollars(addon.price_minor),
      unit: addon.unit,
    })),
  );
  const [pending, setPending] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    setError(null);
    try {
      const saved = await saveBookingSettings(
        tour.id,
        settingsBody({ instant, ttl, policy, childPrice, childAge, rows, host }),
      );
      setRows(
        saved.addons.map((addon) => ({
          id: addon.id,
          name: addon.name,
          price: toDollars(addon.price_minor),
          unit: addon.unit,
        })),
      );
      setNotice(copy.settingsSaved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-control border border-border-subtle bg-surface p-4" onSubmit={onSubmit}>
      <div className="grid gap-1">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Settings2 className="size-4 text-brand" aria-hidden />
          {copy.settingsTitle}
        </h4>
        <p className="text-xs text-text-muted">{host ? copy.hostFree : copy.settingsBody}</p>
      </div>

      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-brand"
          checked={instant}
          onChange={(event) => setInstant(event.target.checked)}
        />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{copy.instantLabel}</span>
          <span className="text-xs text-text-muted">{copy.instantHint}</span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {instant ? null : (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-ttl`}>{copy.ttl}</Label>
            <Input
              id={`${id}-ttl`}
              type="number"
              min={12}
              max={48}
              value={ttl}
              onChange={(event) => setTtl(Number(event.target.value))}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-policy`}>{copy.policyLabel}</Label>
          <NativeSelect
            id={`${id}-policy`}
            value={policy}
            onChange={(event) => setPolicy(event.target.value as CancellationPolicy)}
          >
            {POLICIES.map((item) => (
              <option key={item} value={item}>
                {copy[`policy${item}` as TourBookingKey]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {host ? null : (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-child`}>{copy.childPrice}</Label>
            <Input
              id={`${id}-child`}
              inputMode="decimal"
              value={childPrice}
              onChange={(event) => setChildPrice(event.target.value)}
            />
            <p className="text-xs text-text-muted">{copy.childPriceHint}</p>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-age`}>{copy.childAge}</Label>
          <Input
            id={`${id}-age`}
            type="number"
            min={1}
            max={17}
            value={childAge}
            onChange={(event) => setChildAge(event.target.value)}
          />
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="pb-1 text-sm font-medium">{copy.extras}</legend>
        {rows.map((row, index) => (
          <div key={row.id ?? `new-${index}`} className="grid gap-2 sm:grid-cols-[1fr_7rem_9rem_auto] sm:items-end">
            <div className="grid gap-1">
              <Label htmlFor={`${id}-extra-${index}`} className="text-xs">
                {copy.extraName}
              </Label>
              <Input
                id={`${id}-extra-${index}`}
                maxLength={80}
                value={row.name}
                onChange={(event) =>
                  setRows(rows.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)))
                }
              />
            </div>
            {host ? null : (
              <div className="grid gap-1">
                <Label htmlFor={`${id}-extra-price-${index}`} className="text-xs">
                  {copy.extraPrice}
                </Label>
                <Input
                  id={`${id}-extra-price-${index}`}
                  inputMode="decimal"
                  value={row.price}
                  onChange={(event) =>
                    setRows(rows.map((item, i) => (i === index ? { ...item, price: event.target.value } : item)))
                  }
                />
              </div>
            )}
            <div className="grid gap-1">
              <Label htmlFor={`${id}-extra-unit-${index}`} className="text-xs">
                {copy.extraUnit}
              </Label>
              <NativeSelect
                id={`${id}-extra-unit-${index}`}
                value={row.unit}
                onChange={(event) =>
                  setRows(
                    rows.map((item, i) =>
                      i === index ? { ...item, unit: event.target.value as "person" | "booking" } : item,
                    ),
                  )
                }
              >
                <option value="booking">{interpolate(copy.perBooking, { price: "" }).trim()}</option>
                <option value="person">{interpolate(copy.perPerson, { price: "" }).trim()}</option>
              </NativeSelect>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label={interpolate(copy.removeExtra, { name: row.name || String(index + 1) })}
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              <X aria-hidden />
            </Button>
          </div>
        ))}
        {rows.length < 12 ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRows([...rows, { name: "", price: "", unit: "booking" }])}
            >
              <Plus aria-hidden />
              {copy.addExtra}
            </Button>
          </div>
        ) : null}
      </fieldset>

      {notice ? (
        <Notice tone="success" role="status">
          {notice}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.saveSettings}
        </Button>
      </div>
    </form>
  );
}
