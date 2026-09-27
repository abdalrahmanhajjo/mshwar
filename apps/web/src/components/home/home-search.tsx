"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Compass, MapPin, Search, Users } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import { serializeExperienceFilters, type Destination } from "@/lib/catalog";
import { useHomeCopy } from "@/lib/home-copy";
import { withLocalePrefix } from "@/lib/locale";
import { cn } from "@/lib/utils";
import { MOOD_CATEGORIES, useMoodLabel } from "@/components/home/moods";

const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 8, 10, 12];

/** One labelled cell of the search bar. The whole cell is the hit area; the control stays native. */
function Field({
  icon: Icon,
  label,
  htmlFor,
  children,
  className,
}: {
  icon: typeof MapPin;
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex min-w-0 items-center gap-3 rounded-[0.875rem] px-4 py-2.5 transition-colors duration-150 focus-within:bg-surface-sunken hover:bg-surface-sunken/70",
        className,
      )}
    >
      <Icon className="size-[1.1rem] shrink-0 text-text-muted" strokeWidth={1.6} aria-hidden />
      <div className="grid min-w-0 flex-1">
        <label htmlFor={htmlFor} className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {label}
        </label>
        {children}
      </div>
    </div>
  );
}

const control =
  "w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent py-0.5 text-[0.9375rem] font-medium text-text outline-none [&::-webkit-calendar-picker-indicator]:opacity-60";

/**
 * The hero search: where, when, how many and what kind. It hands off to the
 * experiences list with the same filters the list itself understands.
 */
export function HomeSearch({ destinations }: { destinations: Destination[] }) {
  const copy = useHomeCopy();
  const moodLabel = useMoodLabel();
  const { locale } = useLocale();
  const router = useRouter();
  const [destination, setDestination] = React.useState("");
  const [date, setDate] = React.useState("");
  const [party, setParty] = React.useState("2");
  const [category, setCategory] = React.useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = serializeExperienceFilters({
      destination: destination || undefined,
      date: date || undefined,
      party: party ? Number(party) : undefined,
      category: category || undefined,
      page: 1,
    });
    router.push(withLocalePrefix(locale, query ? `/experiences?${query}` : "/experiences"));
  }

  const divider = "lg:rounded-none lg:border-s lg:border-border-subtle";

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      aria-label={copy.searchLabel}
      className="grid grid-cols-2 gap-1 rounded-[1.25rem] border border-border-subtle bg-surface-raised p-1.5 shadow-[0_18px_40px_-24px_rgb(18_53_47/0.35)] lg:grid-cols-[1.35fr_1fr_0.85fr_1fr_auto] lg:items-center lg:gap-0"
    >
      <Field icon={MapPin} label={copy.searchWhere} htmlFor="home-where" className="col-span-2 lg:col-span-1">
        <select
          id="home-where"
          name="destination"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          className={control}
        >
          <option value="">{copy.searchWhereAny}</option>
          {destinations.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>
      <Field icon={CalendarDays} label={copy.searchWhen} htmlFor="home-when" className={divider}>
        <input
          id="home-when"
          name="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className={cn(control, !date && "text-text-muted")}
        />
      </Field>
      <Field icon={Users} label={copy.searchGuests} htmlFor="home-party" className={divider}>
        <select
          id="home-party"
          name="party"
          value={party}
          onChange={(event) => setParty(event.target.value)}
          className={control}
        >
          {PARTY_SIZES.map((count) => (
            <option key={count} value={count}>
              {interpolate(copy.searchGuestsValue, { n: count })}
            </option>
          ))}
        </select>
      </Field>
      <Field
        icon={Compass}
        label={copy.searchType}
        htmlFor="home-type"
        className={cn("col-span-2 lg:col-span-1", divider)}
      >
        <select
          id="home-type"
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={control}
        >
          <option value="">{copy.searchTypeAny}</option>
          {MOOD_CATEGORIES.map((slug) => (
            <option key={slug} value={slug}>
              {moodLabel(slug)}
            </option>
          ))}
        </select>
      </Field>
      <div className="col-span-2 p-1 lg:col-span-1 lg:ps-2">
        <button
          type="submit"
          className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-[0.875rem] bg-brand px-6 text-[0.9375rem] font-semibold text-brand-foreground transition-colors duration-200 hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] lg:h-14 lg:w-auto"
        >
          <Search className="size-[1.1rem]" strokeWidth={2} aria-hidden />
          {copy.searchSubmit}
        </button>
      </div>
    </form>
  );
}
