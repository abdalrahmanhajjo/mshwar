"use client";

import * as React from "react";
import { Car, Moon } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { interpolate } from "@/i18n/catalogues";
import { understandRequest, type UnderstoodDay } from "@/lib/planner";
import type { PlannerCopy, PlannerKey } from "@/lib/planner-copy";
import { fetchPlaceTypes, type PlaceType } from "@/lib/venues";

const DEBOUNCE_MS = 450;
const MIN_LENGTH = 8;

/**
 * "Here's your day as I understood it": the steps the planner reads in what the traveller typed,
 * shown before anything is planned so they can fix the wording. Only for requests with several steps;
 * an aid, so a failed read shows nothing rather than an error.
 */
export function UnderstoodSteps({ text, copy }: { text: string; copy: PlannerCopy }) {
  const { locale } = useLocale();
  const [day, setDay] = React.useState<UnderstoodDay | null>(null);
  const [types, setTypes] = React.useState<PlaceType[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void fetchPlaceTypes()
      .then((next) => {
        if (!cancelled) setTypes(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_LENGTH) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void understandRequest(trimmed, locale)
        .then((next) => {
          if (!cancelled) setDay(next);
        })
        .catch(() => {
          if (!cancelled) setDay(null);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [text, locale]);

  // Too short to read: show nothing, whatever an earlier read found.
  if (text.trim().length < MIN_LENGTH || !day?.plans_as_day) return null;
  const names = new Map(types.map((type) => [type.slug, type.names[locale]]));
  const label = (step: UnderstoodDay["steps"][number]) => {
    const kinds = step.tags.map((tag) => names.get(tag)).filter(Boolean);
    const head = step.meal ? copy[`meal_${step.meal}` as PlannerKey] : copy[`role_${step.role}` as PlannerKey];
    return kinds.length ? `${head}: ${kinds.join(", ")}` : head;
  };

  return (
    <div className="grid gap-2" aria-live="polite">
      <p className="text-sm font-medium">{copy.understoodTitle}</p>
      <ol className="flex flex-wrap gap-2">
        {day.steps.map((step) => (
          <li key={step.order}>
            <Badge variant={step.optional ? "outline" : "secondary"}>
              {step.order}. {label(step)}
              {step.optional ? ` (${copy.understoodOptional})` : ""}
            </Badge>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 text-sm text-text-muted">
        {day.transport === "driver" ? (
          <span className="inline-flex items-center gap-1">
            <Car className="size-3.5" aria-hidden />
            {copy.understoodDriver}
          </span>
        ) : null}
        {day.ends_overnight ? (
          <span className="inline-flex items-center gap-1">
            <Moon className="size-3.5" aria-hidden />
            {copy.understoodNight}
          </span>
        ) : null}
        {day.avoid_tags.length ? (
          <span>
            {interpolate(copy.understoodAvoid, {
              items: day.avoid_tags.map((tag) => names.get(tag) ?? tag).join(", "),
            })}
          </span>
        ) : null}
      </div>
      {day.unparsed.map((fragment) => (
        <p key={fragment} className="text-sm text-text-muted">
          {interpolate(copy.understoodUnclear, { text: fragment })}
        </p>
      ))}
    </div>
  );
}
