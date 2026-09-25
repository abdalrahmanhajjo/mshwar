"use client";

import * as React from "react";
import { Loader2, Save, X } from "lucide-react";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { useVenuePortalCopy, type VenuePortalKey } from "@/lib/venue-portal-copy";
import {
  fetchListingPlaceTypes,
  fetchPlaceTypes,
  rolesForKind,
  saveListingPlaceTypes,
  type ListingKind,
  type MealService,
  type PlaceType,
  type PlaceTypesInput,
} from "@/lib/venues";

const MAX_TYPES = 6;
const MEALS: MealService[] = ["breakfast", "brunch", "lunch", "dinner", "late"];

/**
 * Business portal: say what kinds of place a listing is, so the trip planner can offer it for the
 * right step of a traveller's day. Only the kinds this listing may be are offered - a meal or a night
 * is always a checked restaurant or stay - and the first one chosen is the main one.
 */
export function PlaceTypesEditor({
  orgId,
  experienceId,
  listingKind,
}: {
  orgId: string;
  experienceId: string;
  listingKind: ListingKind;
}) {
  const copy = useVenuePortalCopy();
  const { locale } = useLocale();
  const [catalogue, setCatalogue] = React.useState<PlaceType[] | null>(null);
  const [chosen, setChosen] = React.useState<string[]>([]);
  const [meals, setMeals] = React.useState<MealService[]>([]);
  const [note, setNote] = React.useState("");
  const [spend, setSpend] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const allowed = React.useMemo(() => {
    const roles = rolesForKind(listingKind);
    return (catalogue ?? []).filter((type) => roles.includes(type.role));
  }, [catalogue, listingKind]);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchPlaceTypes(), fetchListingPlaceTypes(orgId, experienceId)])
      .then(([types, current]) => {
        if (cancelled) return;
        const roles = rolesForKind(listingKind);
        const fits = new Set(types.filter((type) => roles.includes(type.role)).map((type) => type.slug));
        setCatalogue(types);
        // A kind the listing can no longer be (its listing kind changed) is dropped, not resent.
        setChosen(current.place_types.filter((slug) => fits.has(slug)));
        setMeals(current.meal_services);
        setNote(current.schedule_note);
        setSpend(current.typical_spend_minor ? String(current.typical_spend_minor / 100) : "");
      })
      .catch(() => {
        if (!cancelled) setMessage({ tone: "danger", text: copy.loadError });
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, experienceId, listingKind, copy.loadError]);

  if (!catalogue) {
    return message ? (
      <Notice tone="danger" role="alert">
        {message.text}
      </Notice>
    ) : null;
  }

  const name = (slug: string) => catalogue.find((type) => type.slug === slug)?.names[locale] ?? slug;
  const groups = Array.from(new Set(allowed.map((type) => type.group)));
  const full = chosen.length >= MAX_TYPES;
  const needsSchedule = chosen.some((slug) => catalogue.find((type) => type.slug === slug)?.needs_schedule);

  const toggle = (slug: string) =>
    setChosen((current) =>
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : current.length >= MAX_TYPES
          ? current
          : [...current, slug],
    );
  const toggleMeal = (meal: MealService) =>
    setMeals((current) => (current.includes(meal) ? current.filter((item) => item !== meal) : [...current, meal]));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (chosen.length === 0) {
      setMessage({ tone: "danger", text: copy.placeTypesNone });
      return;
    }
    setBusy(true);
    setMessage(null);
    const spendMinor = spend.trim() === "" ? null : Math.round(Number(spend) * 100);
    const input: PlaceTypesInput = {
      place_types: chosen,
      ...(listingKind === "restaurant" ? { meal_services: meals } : {}),
      ...(listingKind === "restaurant" && spendMinor && Number.isFinite(spendMinor)
        ? { typical_spend_minor: spendMinor }
        : {}),
      ...(needsSchedule ? { schedule_note: note.trim() } : {}),
    };
    try {
      const saved = await saveListingPlaceTypes(orgId, experienceId, input);
      setChosen(saved.place_types);
      setMeals(saved.meal_services);
      setNote(saved.schedule_note);
      setMessage({ tone: "success", text: copy.placeTypesSaved });
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, copy.loadError) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{copy.placeTypesTitle}</CardTitle>
        <CardDescription>{copy.placeTypesBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={(event) => void save(event)}>
          <p className="text-sm text-text-muted" id="pt-hint">
            {full ? copy.placeTypesFull : copy.placeTypesHint}
          </p>
          {chosen.length > 0 ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-medium">{copy.placeTypesChosen}</h3>
              <ul className="flex flex-wrap gap-2" aria-label={copy.placeTypesChosen}>
                {chosen.map((slug, index) => (
                  <li
                    key={slug}
                    className="inline-flex items-center gap-1 rounded-full border border-border-subtle px-3 py-1 text-sm"
                  >
                    {name(slug)}
                    {index === 0 ? <Badge variant="secondary">{copy.placeTypesMain}</Badge> : null}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-surface-raised"
                      aria-label={interpolate(copy.placeTypesRemove, { name: name(slug) })}
                      onClick={() => toggle(slug)}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {groups.map((group) => (
            <fieldset key={group} className="grid gap-2" aria-describedby="pt-hint">
              <legend className="mb-1 text-sm font-medium">{copy[`group_${group}` as VenuePortalKey]}</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {allowed
                  .filter((type) => type.group === group)
                  .map((type) => {
                    const checked = chosen.includes(type.slug);
                    return (
                      <label key={type.slug} className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && full}
                          onChange={() => toggle(type.slug)}
                        />
                        {type.names[locale]}
                      </label>
                    );
                  })}
              </div>
            </fieldset>
          ))}
          {listingKind === "restaurant" ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">{copy.mealServices}</legend>
              <div className="flex flex-wrap gap-4">
                {MEALS.map((meal) => (
                  <label key={meal} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={meals.includes(meal)} onChange={() => toggleMeal(meal)} />
                    {copy[`meal_${meal}` as VenuePortalKey]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {listingKind === "restaurant" ? (
            <div className="grid gap-1.5 sm:max-w-xs">
              <Label htmlFor="pt-typical-spend">{copy.typicalSpend}</Label>
              <Input
                id="pt-typical-spend"
                inputMode="decimal"
                dir="ltr"
                value={spend}
                aria-describedby="pt-typical-spend-hint"
                onChange={(event) => setSpend(event.target.value)}
              />
              <p id="pt-typical-spend-hint" className="text-xs text-text-muted">
                {copy.typicalSpendHint}
              </p>
            </div>
          ) : null}
          {needsSchedule ? (
            <div className="grid gap-1.5">
              <Label htmlFor="pt-schedule-note">{copy.scheduleNote}</Label>
              <Input
                id="pt-schedule-note"
                value={note}
                maxLength={280}
                aria-describedby="pt-schedule-hint"
                onChange={(event) => setNote(event.target.value)}
              />
              <p id="pt-schedule-hint" className="text-xs text-text-muted">
                {copy.scheduleNoteHint}
              </p>
            </div>
          ) : null}
          {message ? (
            <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
              {message.text}
            </Notice>
          ) : null}
          <Button type="submit" className="w-fit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save aria-hidden />}
            {copy.placeTypesSave}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
