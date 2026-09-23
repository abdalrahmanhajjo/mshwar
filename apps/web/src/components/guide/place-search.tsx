"use client";

import * as React from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { searchPlaces, type PlaceHit } from "@/lib/place-search";
import { useSearchCopy } from "@/lib/search-copy";

/**
 * Find a catalogue place by typing its name. Results come from the catalogue's
 * own search, as the traveller would see them; the picker hands back the whole
 * place (name, handle, pin) so nobody ever types a handle.
 */
export function PlaceSearch({
  onPick,
  label,
  exclude = [],
  autoFocus = false,
  id: givenId,
}: {
  onPick: (place: PlaceHit) => void;
  label?: string;
  exclude?: string[];
  autoFocus?: boolean;
  id?: string;
}) {
  const copy = useSearchCopy();
  const fallbackId = React.useId();
  const id = givenId ?? fallbackId;
  const listId = `${id}-results`;
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<PlaceHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  // The query the current hits answer; until it catches up, the list is still searching.
  const [settled, setSettled] = React.useState("");
  const excluded = React.useMemo(() => new Set(exclude), [exclude]);
  const shown = hits.filter((hit) => !excluded.has(hit.slug));

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      void searchPlaces(q, 8, controller.signal)
        .then((rows) => {
          setHits(rows);
          setSettled(q);
          setActive(0);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setHits([]);
            setSettled(q);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function pick(hit: PlaceHit) {
    onPick(hit);
    setQuery("");
    setHits([]);
    setSettled("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, Math.max(shown.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && shown[active]) {
      event.preventDefault();
      pick(shown[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const tooShort = query.trim().length < 2;
  const searching = loading || settled !== query.trim();

  return (
    <div className="relative grid gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <Input
          id={id}
          role="combobox"
          aria-expanded={open && !tooShort}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${shown[active].slug}` : undefined}
          aria-label={label ? undefined : copy.placeSearch}
          placeholder={copy.placeSearch}
          autoComplete="off"
          autoFocus={autoFocus}
          value={query}
          className="ps-10"
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
        />
        {searching && !tooShort ? (
          <Loader2
            className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-text-muted"
            aria-label={copy.placeSearching}
          />
        ) : null}
      </div>
      {open && !tooShort ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-1 grid max-h-72 overflow-y-auto rounded-control border border-border-subtle bg-surface-raised p-1 shadow-lg"
        >
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted" role="option" aria-selected={false} aria-disabled>
              {searching ? copy.placeSearching : copy.placeNone}
            </li>
          ) : null}
          {shown.map((hit, index) => (
            <li
              key={hit.slug}
              id={`${listId}-${hit.slug}`}
              role="option"
              aria-selected={index === active}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm",
                index === active ? "bg-brand-subtle" : "hover:bg-surface-sunken",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(hit);
              }}
              onMouseEnter={() => setActive(index)}
            >
              <MapPin className="size-4 shrink-0 text-text-muted" aria-hidden />
              <span className="grid min-w-0">
                <span className="truncate font-medium">{hit.title}</span>
                <span className="truncate text-xs text-text-muted">{hit.placeLabel}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {tooShort && query ? <p className="text-xs text-text-muted">{copy.placeHint}</p> : null}
    </div>
  );
}
