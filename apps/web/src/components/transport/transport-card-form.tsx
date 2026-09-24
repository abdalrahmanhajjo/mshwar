"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { DestinationSelect } from "@/components/guide/pickers";
import { PlaceSearch } from "@/components/guide/place-search";
import { modeLabel } from "@/components/local/transport-card";
import { errorText } from "@/components/partners/step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { useAdminTrustCopy, type AdminTrustKey } from "@/lib/admin-trust-copy";
import { useLocalCopy } from "@/lib/local-copy";
import {
  TRANSPORT_MODES,
  type Evidence,
  type EvidenceKind,
  type FareBasis,
  type TransportCardInput,
  type TransportMode,
  type TransportScope,
} from "@/lib/transport";

const SCOPES: TransportScope[] = ["between", "airport", "around"];
const BASES: FareBasis[] = ["person", "vehicle", "free"];
const CURRENCIES = ["USD", "LBP", "EUR"] as const;

export const EMPTY_CARD: TransportCardInput = {
  scope: "between",
  from_destination: "",
  to_destination: "",
  mode: "service_taxi",
  line_name: "",
  pickup_name: "",
  dropoff_name: "",
  fare_basis: "person",
  fare_low_minor: null,
  fare_high_minor: null,
  currency: "USD",
  duration_min: null,
  duration_max: null,
  frequency_minutes: null,
  first_departure: null,
  last_departure: null,
  runs_sunday: null,
  tips: {},
  step_free: null,
  night_service: null,
  luggage_ok: null,
  safety_note: "",
  evidence: [],
};

const toNumber = (value: string): number | null => {
  if (value.trim() === "") return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
};
const toMinor = (value: string): number | null => {
  const number = toNumber(value);
  return number === null ? null : Math.round(number * 100);
};
const fromMinor = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value / 100);
const fromNumber = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));

function TriState({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: boolean | null | undefined;
  onChange: (next: boolean | null) => void;
}) {
  const copy = useAdminTrustCopy();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect
        id={id}
        value={value === true ? "yes" : value === false ? "no" : ""}
        onChange={(event) => onChange(event.target.value === "yes" ? true : event.target.value === "no" ? false : null)}
      >
        <option value="">{copy.unknown}</option>
        <option value="yes">{copy.yes}</option>
        <option value="no">{copy.no}</option>
      </NativeSelect>
    </div>
  );
}

/**
 * One transport card, as staff write it or a guide proposes it. Destinations and
 * stops are picked by name; evidence says who checked what, and when.
 */
export function TransportCardForm({
  initial,
  submitLabel,
  evidenceKinds,
  onSubmit,
  onCancel,
}: {
  initial?: TransportCardInput;
  submitLabel: string;
  evidenceKinds: EvidenceKind[];
  onSubmit: (input: TransportCardInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const copy = useAdminTrustCopy();
  const local = useLocalCopy();
  const [card, setCard] = React.useState<TransportCardInput>(initial ?? EMPTY_CARD);
  const [low, setLow] = React.useState(fromMinor(initial?.fare_low_minor));
  const [high, setHigh] = React.useState(fromMinor(initial?.fare_high_minor));
  const [evidence, setEvidence] = React.useState<Evidence>({
    kind: evidenceKinds[0] ?? "field_check",
    note: "",
    url: "",
    on: null,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const set = <K extends keyof TransportCardInput>(key: K, value: TransportCardInput[K]) =>
    setCard((current) => ({ ...current, [key]: value }));

  function addEvidence() {
    if (evidence.note.trim().length < 5) return;
    set("evidence", [
      ...card.evidence,
      {
        kind: evidence.kind,
        note: evidence.note.trim(),
        ...(evidence.url ? { url: evidence.url.trim() } : {}),
        on: evidence.on || null,
      },
    ]);
    setEvidence({ kind: evidence.kind, note: "", url: "", on: null });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const free = card.fare_basis === "free";
    try {
      await onSubmit({
        ...card,
        from_destination: card.scope === "between" ? card.from_destination || null : null,
        fare_low_minor: free ? null : toMinor(low),
        fare_high_minor: free ? null : (toMinor(high) ?? toMinor(low)),
        currency: free ? null : card.currency,
        first_departure: card.first_departure ? card.first_departure.slice(0, 5) : null,
        last_departure: card.last_departure ? card.last_departure.slice(0, 5) : null,
        tips: Object.fromEntries(Object.entries(card.tips ?? {}).filter(([, text]) => text && text.trim())),
      });
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  const ready =
    card.to_destination !== "" && card.evidence.length > 0 && (card.scope !== "between" || card.from_destination);

  return (
    <form className="grid gap-5" onSubmit={(event) => void submit(event)}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tc-scope">{copy.scopeLabel}</Label>
          <NativeSelect
            id="tc-scope"
            value={card.scope}
            onChange={(event) => set("scope", event.target.value as TransportScope)}
          >
            {SCOPES.map((scope) => (
              <option key={scope} value={scope}>
                {copy[`scope_${scope}` as AdminTrustKey]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {card.scope === "between" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="tc-from">{copy.fromLabel}</Label>
            <DestinationSelect
              id="tc-from"
              value={card.from_destination ?? ""}
              onChange={(slug) => set("from_destination", slug)}
            />
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <Label htmlFor="tc-to">{card.scope === "around" ? copy.destinationLabel : copy.toLabel}</Label>
          <DestinationSelect id="tc-to" value={card.to_destination} onChange={(slug) => set("to_destination", slug)} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tc-mode">{copy.modeLabel}</Label>
          <NativeSelect
            id="tc-mode"
            value={card.mode}
            onChange={(event) => set("mode", event.target.value as TransportMode)}
          >
            {TRANSPORT_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {modeLabel(mode, local)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tc-line">{copy.lineName}</Label>
          <Input
            id="tc-line"
            maxLength={80}
            value={card.line_name ?? ""}
            onChange={(event) => set("line_name", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(["pickup", "dropoff"] as const).map((end) => (
          <div key={end} className="grid gap-1.5">
            <Label htmlFor={`tc-${end}`}>{end === "pickup" ? copy.pickupName : copy.dropoffName}</Label>
            <Input
              id={`tc-${end}`}
              maxLength={120}
              value={card[`${end}_name`] ?? ""}
              onChange={(event) =>
                setCard((current) => ({
                  ...current,
                  [`${end}_name`]: event.target.value,
                  [`${end}_lat`]: null,
                  [`${end}_lng`]: null,
                }))
              }
            />
            <PlaceSearch
              id={`tc-${end}-search`}
              onPick={(hit) =>
                setCard((current) => ({
                  ...current,
                  [`${end}_name`]: hit.title,
                  [`${end}_lat`]: hit.lat,
                  [`${end}_lng`]: hit.lng,
                }))
              }
            />
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="tc-basis">{copy.fareBasis}</Label>
          <NativeSelect
            id="tc-basis"
            value={card.fare_basis}
            onChange={(event) => set("fare_basis", event.target.value as FareBasis)}
          >
            {BASES.map((basis) => (
              <option key={basis} value={basis}>
                {copy[`basis_${basis}` as AdminTrustKey]}
              </option>
            ))}
          </NativeSelect>
        </div>
        {card.fare_basis !== "free" ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="tc-low">{copy.fareLow}</Label>
              <Input
                id="tc-low"
                inputMode="decimal"
                dir="ltr"
                value={low}
                onChange={(event) => setLow(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tc-high">{copy.fareHigh}</Label>
              <Input
                id="tc-high"
                inputMode="decimal"
                dir="ltr"
                value={high}
                onChange={(event) => setHigh(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tc-currency">{copy.currencyLabel}</Label>
              <NativeSelect
                id="tc-currency"
                value={card.currency ?? "USD"}
                onChange={(event) => set("currency", event.target.value as (typeof CURRENCIES)[number])}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {(
          [
            ["duration_min", copy.durMin],
            ["duration_max", copy.durMax],
            ["frequency_minutes", copy.frequency],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="grid gap-1.5">
            <Label htmlFor={`tc-${key}`}>{label}</Label>
            <Input
              id={`tc-${key}`}
              type="number"
              min={0}
              value={fromNumber(card[key])}
              onChange={(event) => set(key, toNumber(event.target.value))}
            />
          </div>
        ))}
        <div className="grid gap-1.5">
          <Label htmlFor="tc-first">{copy.firstDep}</Label>
          <Input
            id="tc-first"
            type="time"
            value={card.first_departure?.slice(0, 5) ?? ""}
            onChange={(event) => set("first_departure", event.target.value || null)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tc-last">{copy.lastDep}</Label>
          <Input
            id="tc-last"
            type="time"
            value={card.last_departure?.slice(0, 5) ?? ""}
            onChange={(event) => set("last_departure", event.target.value || null)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <TriState
          id="tc-sunday"
          label={copy.sundayQ}
          value={card.runs_sunday}
          onChange={(value) => set("runs_sunday", value)}
        />
        <TriState
          id="tc-step"
          label={copy.stepFreeQ}
          value={card.step_free}
          onChange={(value) => set("step_free", value)}
        />
        <TriState
          id="tc-night"
          label={copy.nightQ}
          value={card.night_service}
          onChange={(value) => set("night_service", value)}
        />
        <TriState
          id="tc-luggage"
          label={copy.luggageQ}
          value={card.luggage_ok}
          onChange={(value) => set("luggage_ok", value)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {(["en", "ar", "fr"] as const).map((lang) => (
          <div key={lang} className="grid gap-1.5">
            <Label htmlFor={`tc-tip-${lang}`}>{copy[`tip_${lang}`]}</Label>
            <Textarea
              id={`tc-tip-${lang}`}
              rows={3}
              maxLength={600}
              dir={lang === "ar" ? "rtl" : "ltr"}
              value={card.tips?.[lang] ?? ""}
              onChange={(event) => set("tips", { ...card.tips, [lang]: event.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tc-safety">{copy.safetyNote}</Label>
        <Input
          id="tc-safety"
          maxLength={300}
          value={card.safety_note ?? ""}
          onChange={(event) => set("safety_note", event.target.value)}
        />
      </div>

      <fieldset className="grid gap-3 rounded-control border border-border-subtle p-3">
        <legend className="px-1 text-sm font-semibold">{copy.evidenceTitle}</legend>
        {card.evidence.length ? (
          <ul className="grid gap-2 text-sm">
            {card.evidence.map((item, index) => (
              <li
                key={`${item.kind}-${index}`}
                className="flex items-start justify-between gap-2 rounded-control bg-surface-sunken px-3 py-2"
              >
                <span>
                  <span className="font-medium">{copy[`ev_${item.kind}` as AdminTrustKey]}</span>
                  {item.on ? ` · ${item.on}` : ""} · {item.note}
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noreferrer" className="ms-1 underline">
                      ↗
                    </a>
                  ) : null}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={copy.remove}
                  onClick={() =>
                    set(
                      "evidence",
                      card.evidence.filter((_, position) => position !== index),
                    )
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">{copy.needEvidence}</p>
        )}
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="grid gap-1.5">
            <Label htmlFor="tc-ev-kind">{copy.evidenceKind}</Label>
            <NativeSelect
              id="tc-ev-kind"
              value={evidence.kind}
              onChange={(event) => setEvidence({ ...evidence, kind: event.target.value as EvidenceKind })}
            >
              {evidenceKinds.map((kind) => (
                <option key={kind} value={kind}>
                  {copy[`ev_${kind}` as AdminTrustKey]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tc-ev-note">{copy.evidenceNote}</Label>
            <Input
              id="tc-ev-note"
              maxLength={500}
              value={evidence.note}
              onChange={(event) => setEvidence({ ...evidence, note: event.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tc-ev-on">{copy.evidenceOn}</Label>
            <Input
              id="tc-ev-on"
              type="date"
              value={evidence.on ?? ""}
              onChange={(event) => setEvidence({ ...evidence, on: event.target.value || null })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tc-ev-url">{copy.evidenceUrl}</Label>
            <Input
              id="tc-ev-url"
              type="url"
              dir="ltr"
              value={evidence.url ?? ""}
              onChange={(event) => setEvidence({ ...evidence, url: event.target.value })}
            />
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit"
          disabled={evidence.note.trim().length < 5}
          onClick={addEvidence}
        >
          <Plus aria-hidden />
          {copy.addEvidence}
        </Button>
      </fieldset>

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !ready}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {copy.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
