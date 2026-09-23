"use client";

import * as React from "react";
import { Check, LocateFixed, Loader2, Plus, Search, X } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { cn, focusRing } from "@/lib/utils";
import {
  COMMON_LANGUAGES,
  inLebanon,
  languageName,
  loadDestinationOptions,
  type DestinationOption,
} from "@/lib/place-search";
import { useSearchCopy } from "@/lib/search-copy";

/** The destination list, shared across pickers on a page. Empty until it loads. */
export function useDestinations(): DestinationOption[] {
  const [rows, setRows] = React.useState<DestinationOption[]>([]);
  React.useEffect(() => {
    let cancelled = false;
    void loadDestinationOptions()
      .then((next) => {
        if (!cancelled) {
          setRows(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return rows;
}

/** Pick one destination by its name. Keeps an unknown current value selectable. */
export function DestinationSelect({
  id,
  value,
  onChange,
  allowAny,
  anyLabel,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (slug: string) => void;
  allowAny?: boolean;
  anyLabel?: string;
  "aria-label"?: string;
}) {
  const copy = useSearchCopy();
  const destinations = useDestinations();
  const known = destinations.some((row) => row.slug === value);
  return (
    <NativeSelect id={id} aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>
      {allowAny ? <option value="">{anyLabel ?? copy.destinationPick}</option> : null}
      {!allowAny && !value ? <option value="">{copy.destinationPick}</option> : null}
      {value && !known ? <option value={value}>{value}</option> : null}
      {destinations.map((row) => (
        <option key={row.slug} value={row.slug}>
          {row.region && row.region !== row.name ? `${row.name} · ${row.region}` : row.name}
        </option>
      ))}
    </NativeSelect>
  );
}

function Chip({
  selected,
  onClick,
  children,
  disabled,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-pill border px-3 text-sm transition-colors disabled:opacity-50",
        selected
          ? "border-brand bg-brand text-brand-foreground"
          : "border-border-subtle bg-surface hover:border-brand hover:bg-brand-subtle",
        focusRing,
      )}
    >
      {selected ? <Check className="size-3.5" aria-hidden /> : null}
      {children}
    </button>
  );
}

/** The areas a guide covers, chosen by name. Stored as destination handles. */
export function RegionPicker({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  const destinations = useDestinations();
  const toggle = (slug: string) =>
    onChange(value.includes(slug) ? value.filter((item) => item !== slug) : [...value, slug]);
  const unknown = value.filter((slug) => !destinations.some((row) => row.slug === slug));
  return (
    <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {destinations.map((row) => (
        <Chip key={row.slug} selected={value.includes(row.slug)} disabled={disabled} onClick={() => toggle(row.slug)}>
          {row.name}
        </Chip>
      ))}
      {unknown.map((slug) => (
        <Chip key={slug} selected disabled={disabled} onClick={() => toggle(slug)}>
          {slug}
        </Chip>
      ))}
    </div>
  );
}

/** Languages by their name in the reader's language, with room for any other. */
export function LanguagePicker({
  value,
  onChange,
  disabled,
  labelledBy,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  labelledBy?: string;
}) {
  const copy = useSearchCopy();
  const { locale } = useLocale();
  const [other, setOther] = React.useState("");
  const codes = [
    ...COMMON_LANGUAGES,
    ...value.filter((code) => !(COMMON_LANGUAGES as readonly string[]).includes(code)),
  ];
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
  const otherCode = other.trim().toLowerCase();
  const validOther = /^[a-z]{2,3}$/.test(otherCode);
  return (
    <div className="grid gap-2">
      <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
        {codes.map((code) => (
          <Chip key={code} selected={value.includes(code)} disabled={disabled} onClick={() => toggle(code)}>
            {languageName(code, locale)}
          </Chip>
        ))}
      </div>
      <div className="flex max-w-xs gap-2">
        <Input
          aria-label={copy.languageOther}
          placeholder={copy.languageOther}
          value={other}
          disabled={disabled}
          maxLength={3}
          onChange={(event) => setOther(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !validOther || value.includes(otherCode)}
          onClick={() => {
            onChange([...value, otherCode]);
            setOther("");
          }}
        >
          <Plus aria-hidden />
          {copy.languageAdd}
        </Button>
      </div>
    </div>
  );
}

/** A removable list of chosen names (languages on a tour, stops, and so on). */
export function ChosenChips({
  items,
  onRemove,
}: {
  items: { key: string; label: string }[];
  onRemove: (key: string) => void;
}) {
  const copy = useSearchCopy();
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.key}>
          <span className="inline-flex items-center gap-1 rounded-pill bg-brand-subtle px-3 py-1 text-sm">
            {item.label}
            <button
              type="button"
              aria-label={interpolate(copy.remove, { name: item.label })}
              className={cn("rounded-full p-0.5 hover:bg-surface-sunken", focusRing)}
              onClick={() => onRemove(item.key)}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Fill a pin from the device's location, refusing anything outside Lebanon. */
export function LocateButton({ onLocate }: { onLocate: (lat: number, lng: number) => void }) {
  const copy = useSearchCopy();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function locate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError(copy.locationDenied);
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        const lat = Math.round(position.coords.latitude * 1e5) / 1e5;
        const lng = Math.round(position.coords.longitude * 1e5) / 1e5;
        if (!inLebanon(lat, lng)) {
          setError(copy.locationOutside);
          return;
        }
        onLocate(lat, lng);
      },
      () => {
        setBusy(false);
        setError(copy.locationDenied);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={busy} onClick={locate}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
        {busy ? copy.locating : copy.myLocation}
      </Button>
      {error ? (
        <Notice tone="warning" role="status">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}

/** "Pin set" line with a map link, so a guide can check the pin they chose. */
export function PinSummary({ lat, lng }: { lat: number; lng: number }) {
  const copy = useSearchCopy();
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
      {interpolate(copy.pinSet, { lat: String(lat), lng: String(lng) })}
      <a
        href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {copy.openMap}
      </a>
    </p>
  );
}

/** A search box for filtering a list already on screen, with a live count for screen readers. */
export function ListSearch({
  value,
  onChange,
  placeholder,
  shown,
  total,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  shown?: number;
  total?: number;
}) {
  const copy = useSearchCopy();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <Input
          type="search"
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          className="ps-10"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {value && shown !== undefined && total !== undefined ? (
        <span role="status" className="text-sm text-text-muted">
          {interpolate(copy.resultCount, { n: String(shown) })}
          {shown < total ? ` / ${total}` : null}
        </span>
      ) : null}
    </div>
  );
}

/** Show handles and codes as names: destination names for areas, language names for codes. */
export function useDisplayNames(): { region: (slug: string) => string; language: (code: string) => string } {
  const destinations = useDestinations();
  const { locale } = useLocale();
  return React.useMemo(() => {
    const names = new Map(destinations.map((row) => [row.slug, row.name]));
    return {
      region: (slug: string) => names.get(slug) ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      language: (code: string) => languageName(code, locale),
    };
  }, [destinations, locale]);
}
