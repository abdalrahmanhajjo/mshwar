"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { IntentReleases, PhraseReview } from "@/components/admin/phrase-review";
import { useLoad } from "@/components/admin/use-load";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import {
  addIntentPhrase,
  fetchIntentMisses,
  fetchIntentPhrases,
  fetchPlannerConcepts,
  fetchStepGaps,
  retireIntentPhrase,
  reviewIntentMiss,
  type IntentMiss,
  type IntentPhrase,
  type MissStatus,
  type PhraseLocale,
  type PlannerConcept,
  type StepGap,
} from "@/lib/admin-catalogue";
import { useAdminCatalogueCopy, type AdminCatalogueCopy, type AdminCatalogueKey } from "@/lib/admin-catalogue-copy";
import { usePlannerCopy, type PlannerKey } from "@/lib/planner-copy";
import { fetchPlaceTypes } from "@/lib/venues";

const PERIODS = [7, 30, 90, 365];
const LOCALES: PhraseLocale[] = ["en", "ar", "ar-LB", "arabizi", "fr", "mixed"];
const MISS_STATUSES: MissStatus[] = ["open", "resolved", "dismissed"];
const localeKey = (value: string) => `loc_${value.replace("-", "")}` as AdminCatalogueKey;

function Loading({ failed, copy }: { failed: boolean; copy: AdminCatalogueCopy }) {
  return failed ? (
    <Notice tone="danger" role="alert">
      {copy.loadError}
    </Notice>
  ) : (
    <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden />
  );
}

function GapsTable({ gaps, names }: { gaps: StepGap[]; names: Map<string, string> }) {
  const copy = useAdminCatalogueCopy();
  const planner = usePlannerCopy();
  const step = (gap: StepGap) => {
    const head = gap.meal
      ? planner[`meal_${gap.meal}` as PlannerKey]
      : (planner[`role_${gap.role}` as PlannerKey] ?? gap.role);
    return gap.tag ? `${head} · ${names.get(gap.tag) ?? gap.tag}` : head;
  };
  return (
    <div className="overflow-x-auto rounded-card border border-border-subtle">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="bg-surface-sunken text-text-muted">
          <tr>
            <th className="px-3 py-2 text-start font-medium">{copy.colStep}</th>
            <th className="px-3 py-2 text-start font-medium">{copy.destinationLabel}</th>
            <th className="px-3 py-2 text-start font-medium">{copy.reasonLabel}</th>
            <th className="px-3 py-2 text-end font-medium">{copy.colTimes}</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => (
            <tr
              key={`${gap.destination_slug}-${gap.role}-${gap.tag}-${gap.meal}-${gap.reason}`}
              className="border-t border-border-subtle"
            >
              <td className="px-3 py-2">{step(gap)}</td>
              <td className="px-3 py-2">{gap.destination_slug || copy.anywhere}</td>
              <td className="px-3 py-2 text-text-muted">
                {planner[`reason_${gap.reason}` as PlannerKey] ?? gap.reason}
              </td>
              <td className="px-3 py-2 text-end tabular-nums">{gap.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConceptSelect({
  id,
  value,
  onChange,
  concepts,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  concepts: PlannerConcept[];
}) {
  const copy = useAdminCatalogueCopy();
  return (
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{copy.chooseConcept}</option>
      {concepts.map((concept) => (
        <option key={concept.slug} value={concept.slug}>
          {concept.slug} ({concept.example})
        </option>
      ))}
    </NativeSelect>
  );
}

function LocaleSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: PhraseLocale;
  onChange: (value: PhraseLocale) => void;
}) {
  const copy = useAdminCatalogueCopy();
  return (
    <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value as PhraseLocale)}>
      {LOCALES.map((item) => (
        <option key={item} value={item}>
          {copy[localeKey(item)]}
        </option>
      ))}
    </NativeSelect>
  );
}

function MissRow({ miss, concepts, onDone }: { miss: IntentMiss; concepts: PlannerConcept[]; onDone: () => void }) {
  const copy = useAdminCatalogueCopy();
  const { locale } = useLocale();
  const [phrase, setPhrase] = React.useState(miss.fragment);
  const [concept, setConcept] = React.useState("");
  const [phraseLocale, setPhraseLocale] = React.useState<PhraseLocale>(
    LOCALES.includes(miss.locale as PhraseLocale) ? (miss.locale as PhraseLocale) : "mixed",
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function decide(body: Parameters<typeof reviewIntentMiss>[1]) {
    setBusy(true);
    setError("");
    try {
      await reviewIntentMiss(miss.id, body);
      onDone();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <q className="font-medium" dir="auto">
          {miss.fragment}
        </q>
        <span className="text-sm text-text-muted">
          {interpolate(copy.missSeen, {
            count: miss.count,
            date: formatDate(locale, miss.last_seen, { dateStyle: "medium" }),
          })}
        </span>
      </div>
      {miss.status === "open" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor={`miss-phrase-${miss.id}`}>{copy.phraseLabel}</Label>
            <Input
              id={`miss-phrase-${miss.id}`}
              value={phrase}
              maxLength={80}
              dir="auto"
              onChange={(event) => setPhrase(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`miss-concept-${miss.id}`}>{copy.missConcept}</Label>
            <ConceptSelect id={`miss-concept-${miss.id}`} value={concept} onChange={setConcept} concepts={concepts} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`miss-locale-${miss.id}`}>{copy.phraseLocale}</Label>
            <LocaleSelect id={`miss-locale-${miss.id}`} value={phraseLocale} onChange={setPhraseLocale} />
          </div>
        </div>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {miss.status === "open" ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy || !concept || !phrase.trim()}
            onClick={() => void decide({ decision: "phrase", phrase: phrase.trim(), concept, locale: phraseLocale })}
          >
            {copy.missTeach}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void decide({ decision: "dismiss" })}
          >
            {copy.missDismiss}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function AddPhrase({ concepts, onAdded }: { concepts: PlannerConcept[]; onAdded: () => void }) {
  const copy = useAdminCatalogueCopy();
  const [phrase, setPhrase] = React.useState("");
  const [concept, setConcept] = React.useState("");
  const [phraseLocale, setPhraseLocale] = React.useState<PhraseLocale>("mixed");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await addIntentPhrase({ phrase: phrase.trim(), concept, locale: phraseLocale });
      setPhrase("");
      setConcept("");
      onAdded();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={(event) => void add(event)}>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="new-phrase">{copy.phraseLabel}</Label>
          <Input
            id="new-phrase"
            value={phrase}
            maxLength={80}
            dir="auto"
            onChange={(event) => setPhrase(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-phrase-concept">{copy.missConcept}</Label>
          <ConceptSelect id="new-phrase-concept" value={concept} onChange={setConcept} concepts={concepts} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-phrase-locale">{copy.phraseLocale}</Label>
          <LocaleSelect id="new-phrase-locale" value={phraseLocale} onChange={setPhraseLocale} />
        </div>
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Button type="submit" size="sm" className="w-fit" disabled={busy || !concept || !phrase.trim()}>
        <Plus aria-hidden />
        {copy.phraseAdd}
      </Button>
    </form>
  );
}

function PhraseList({ phrases, onChanged }: { phrases: IntentPhrase[]; onChanged: () => void }) {
  const copy = useAdminCatalogueCopy();
  if (!phrases.length) return <p className="text-sm text-text-muted">{copy.phrasesEmpty}</p>;
  return (
    <ul className="grid gap-2">
      {phrases.map((phrase) => (
        <li
          key={phrase.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-sunken px-3 py-2 text-sm"
        >
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium" dir="auto">
              {phrase.phrase}
            </span>
            <span className="text-text-muted">→ {phrase.concept}</span>
            <Badge variant="secondary">{copy[localeKey(phrase.locale)]}</Badge>
            {phrase.status === "retired" ? <Badge variant="warning">{copy.phraseRetired}</Badge> : null}
          </span>
          {phrase.status === "approved" ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void retireIntentPhrase(phrase.id).then(onChanged, onChanged)}
            >
              {copy.phraseRetire}
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** /admin/planner/language: unmet demand, words the planner could not read, and the phrases it learned. */
export function PlannerLanguageAdmin() {
  const copy = useAdminCatalogueCopy();
  const [days, setDays] = React.useState(30);
  const [missStatus, setMissStatus] = React.useState<MissStatus>("open");
  const gaps = useLoad(() => fetchStepGaps(days), `gaps:${days}`);
  const misses = useLoad(() => fetchIntentMisses(missStatus), `misses:${missStatus}`);
  const phrases = useLoad(fetchIntentPhrases, "phrases");
  const concepts = useLoad(fetchPlannerConcepts, "concepts");
  const types = useLoad(fetchPlaceTypes, "types");
  const { locale } = useLocale();
  const names = React.useMemo(
    () => new Map((types.data ?? []).map((type) => [type.slug, type.names[locale]])),
    [types.data, locale],
  );
  const [releaseVersion, setReleaseVersion] = React.useState(0);
  const learned = () => {
    misses.reload();
    phrases.reload();
  };

  return (
    <div className="grid gap-8">
      <PageHeader title={copy.plTitle} description={copy.plBody} />

      <section className="grid gap-3" aria-labelledby="gaps-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h2 id="gaps-heading" className="font-semibold">
              {copy.gapsTitle}
            </h2>
            <p className="text-sm text-text-muted">{copy.gapsBody}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="gaps-period">{copy.period}</Label>
            <NativeSelect id="gaps-period" value={days} onChange={(event) => setDays(Number(event.target.value))}>
              {PERIODS.map((value) => (
                <option key={value} value={value}>
                  {interpolate(copy.lastDays, { days: value })}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {gaps.data ? (
          gaps.data.length ? (
            <GapsTable gaps={gaps.data} names={names} />
          ) : (
            <p className="text-sm text-text-muted">{copy.gapsEmpty}</p>
          )
        ) : (
          <Loading failed={gaps.failed} copy={copy} />
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="misses-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="grid gap-1">
            <h2 id="misses-heading" className="font-semibold">
              {copy.missesTitle}
            </h2>
            <p className="text-sm text-text-muted">{copy.missesBody}</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="misses-status">{copy.statusLabel}</Label>
            <NativeSelect
              id="misses-status"
              value={missStatus}
              onChange={(event) => setMissStatus(event.target.value as MissStatus)}
            >
              {MISS_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {copy[`ms_${value}`]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {misses.data ? (
          misses.data.length ? (
            <ul className="grid gap-3">
              {misses.data.map((miss) => (
                <MissRow key={miss.id} miss={miss} concepts={concepts.data ?? []} onDone={learned} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">{copy.missesEmpty}</p>
          )
        ) : (
          <Loading failed={misses.failed} copy={copy} />
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="phrases-heading">
        <div className="grid gap-1">
          <h2 id="phrases-heading" className="font-semibold">
            {copy.phrasesTitle}
          </h2>
          <p className="text-sm text-text-muted">{copy.phrasesBody}</p>
        </div>
        <AddPhrase concepts={concepts.data ?? []} onAdded={phrases.reload} />
        {phrases.data ? (
          <PhraseList phrases={phrases.data} onChanged={phrases.reload} />
        ) : (
          <Loading failed={phrases.failed} copy={copy} />
        )}
      </section>

      <PhraseReview
        concepts={concepts.data ?? []}
        onChanged={() => {
          phrases.reload();
          setReleaseVersion((value) => value + 1);
        }}
      />
      <IntentReleases version={releaseVersion} />
    </div>
  );
}
