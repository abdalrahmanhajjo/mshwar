"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { useVenuePortalCopy, type VenuePortalKey } from "@/lib/venue-portal-copy";
import {
  ACCESS_FACTS,
  FOOD_FACTS,
  PAYMENT_FACTS,
  VIEWS,
  fetchListingFacts,
  saveListingFacts,
  type FactFlag,
  type ListingKind,
  type PlaceFacts,
  type PlaceView,
} from "@/lib/venues";

type Answer = "unknown" | "yes" | "no";

const answerOf = (value: boolean | undefined): Answer => (value === undefined ? "unknown" : value ? "yes" : "no");

/**
 * Business portal: the facts travellers filter a day on - halal, wheelchair access, a sea view, cards.
 * Every answer can stay "not sure": the planner keeps an unknown place but tells the traveller it is
 * unconfirmed, and only a "no" keeps the place out of a day that needs it.
 */
export function PlaceFactsEditor({
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
  const [loaded, setLoaded] = React.useState(false);
  const [answers, setAnswers] = React.useState<Partial<Record<FactFlag, Answer>>>({});
  const [views, setViews] = React.useState<PlaceView[]>([]);
  const [minAge, setMinAge] = React.useState("");
  const [languages, setLanguages] = React.useState("");
  const [dressCode, setDressCode] = React.useState("");
  const [checked, setChecked] = React.useState<{ on?: string; stale?: boolean }>({});
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const show = React.useCallback((facts: PlaceFacts) => {
    const next: Partial<Record<FactFlag, Answer>> = {};
    for (const flag of [...FOOD_FACTS, ...ACCESS_FACTS, ...PAYMENT_FACTS]) next[flag] = answerOf(facts[flag]);
    setAnswers(next);
    setViews(facts.views ?? []);
    setMinAge(facts.min_age != null ? String(facts.min_age) : "");
    setLanguages((facts.languages ?? []).join(", "));
    setDressCode(facts.dress_code ?? "");
    setChecked({ on: facts.checked_on, stale: facts.stale });
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void fetchListingFacts(orgId, experienceId)
      .then((facts) => {
        if (cancelled) return;
        show(facts);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setMessage({ tone: "danger", text: copy.loadError });
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, experienceId, show, copy.loadError]);

  if (!loaded) {
    return message ? (
      <Notice tone="danger" role="alert">
        {message.text}
      </Notice>
    ) : null;
  }

  const groups: { title: VenuePortalKey; flags: readonly FactFlag[] }[] = [
    ...(listingKind === "restaurant" ? [{ title: "factsFood" as const, flags: FOOD_FACTS }] : []),
    { title: "factsAccess", flags: ACCESS_FACTS },
    { title: "factsPayment", flags: PAYMENT_FACTS },
  ];

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const input: PlaceFacts = {
      views,
      languages: languages
        .split(/[,،]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8),
      dress_code: dressCode.trim(),
    };
    for (const [flag, answer] of Object.entries(answers) as [FactFlag, Answer][]) {
      if (answer !== "unknown") input[flag] = answer === "yes";
    }
    const age = minAge.trim() === "" ? null : Number(minAge);
    if (age !== null && Number.isInteger(age)) input.min_age = age;
    try {
      show(await saveListingFacts(orgId, experienceId, input));
      setMessage({ tone: "success", text: copy.factsSaved });
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, copy.loadError) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{copy.factsTitle}</CardTitle>
        <CardDescription>{copy.factsBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={(event) => void save(event)}>
          {checked.stale ? (
            <Notice tone="warning">{copy.factsStale}</Notice>
          ) : checked.on ? (
            <p className="text-sm text-text-muted">
              {interpolate(copy.factsCheckedOn, { date: formatDate(locale, `${checked.on}T12:00:00Z`) })}
            </p>
          ) : null}
          {groups.map((group) => (
            <fieldset key={group.title} className="grid gap-3">
              <legend className="mb-1 text-sm font-medium">{copy[group.title]}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {group.flags.map((flag) => (
                  <div key={flag} className="grid gap-1.5">
                    <Label htmlFor={`fact-${flag}`}>{copy[`fact_${flag}` as VenuePortalKey]}</Label>
                    <NativeSelect
                      id={`fact-${flag}`}
                      value={answers[flag] ?? "unknown"}
                      onChange={(event) =>
                        setAnswers((current) => ({ ...current, [flag]: event.target.value as Answer }))
                      }
                    >
                      <option value="unknown">{copy.factsUnknown}</option>
                      <option value="yes">{copy.factsYes}</option>
                      <option value="no">{copy.factsNo}</option>
                    </NativeSelect>
                  </div>
                ))}
              </div>
            </fieldset>
          ))}
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{copy.factsViews}</legend>
            <div className="flex flex-wrap gap-4">
              {VIEWS.map((view) => (
                <label key={view} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={views.includes(view)}
                    onChange={() =>
                      setViews((current) =>
                        current.includes(view) ? current.filter((item) => item !== view) : [...current, view],
                      )
                    }
                  />
                  {copy[`view_${view}` as VenuePortalKey]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            {listingKind !== "restaurant" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="fact-min-age">{copy.factsMinAge}</Label>
                <Input
                  id="fact-min-age"
                  type="number"
                  min={0}
                  max={25}
                  dir="ltr"
                  value={minAge}
                  onChange={(event) => setMinAge(event.target.value)}
                />
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="fact-languages">{copy.factsLanguages}</Label>
              <Input
                id="fact-languages"
                value={languages}
                aria-describedby="fact-languages-hint"
                onChange={(event) => setLanguages(event.target.value)}
              />
              <p id="fact-languages-hint" className="text-xs text-text-muted">
                {copy.factsLanguagesHint}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fact-dress-code">{copy.factsDressCode}</Label>
              <Input
                id="fact-dress-code"
                value={dressCode}
                maxLength={120}
                onChange={(event) => setDressCode(event.target.value)}
              />
            </div>
          </div>
          {message ? (
            <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
              {message.text}
            </Notice>
          ) : null}
          <Button type="submit" className="w-fit" disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save aria-hidden />}
            {copy.factsSave}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
