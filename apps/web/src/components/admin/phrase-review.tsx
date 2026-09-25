"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLoad } from "@/components/admin/use-load";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import {
  fetchPhraseBatches,
  fetchPhraseCandidates,
  fetchReleases,
  releaseIntentData,
  reviewPhraseCandidates,
  type PhraseLocale,
  type PlannerConcept,
} from "@/lib/admin-catalogue";
import { useAdminCatalogueCopy, type AdminCatalogueKey } from "@/lib/admin-catalogue-copy";
import { ApiError } from "@/lib/api/client";

const PAGE = 50;
const LOCALES: PhraseLocale[] = ["en", "ar", "ar-LB", "arabizi", "fr", "mixed"];
const localeKey = (value: string) => `loc_${value.replace("-", "")}` as AdminCatalogueKey;
const percent = (value: number) => `${Math.round(value * 1000) / 10}%`;

/**
 * Candidate phrases, a page at a time: approve what people really write, reject the rest. Approving
 * makes the planner read a phrase at once; a release then records the approved set with its eval results.
 */
export function PhraseReview({ concepts, onChanged }: { concepts: PlannerConcept[]; onChanged: () => void }) {
  const copy = useAdminCatalogueCopy();
  const [batch, setBatch] = React.useState("");
  const [concept, setConcept] = React.useState("");
  const [locale, setLocale] = React.useState("");
  const [offset, setOffset] = React.useState(0);
  const [chosen, setChosen] = React.useState<Set<string>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const batches = useLoad(fetchPhraseBatches, "batches");
  const page = useLoad(
    () => fetchPhraseCandidates({ batch, concept, locale, status: "candidate", limit: PAGE, offset }),
    `candidates:${batch}:${concept}:${locale}:${offset}`,
  );
  const items = page.data?.items ?? [];

  const filter = (set: (value: string) => void) => (value: string) => {
    set(value);
    setOffset(0);
    setChosen(new Set());
  };
  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChosen = items.length > 0 && items.every((item) => chosen.has(item.id));

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setMessage(null);
    try {
      const result = await reviewPhraseCandidates([...chosen], decision);
      setMessage({ tone: "success", text: interpolate(copy.reviewDone, result) });
      setChosen(new Set());
      page.reload();
      batches.reload();
      onChanged();
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, copy.loadError) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3" aria-labelledby="review-heading">
      <div className="grid gap-1">
        <h2 id="review-heading" className="font-semibold">
          {copy.reviewTitle}
        </h2>
        <p className="text-sm text-text-muted">{copy.reviewBody}</p>
      </div>
      {batches.data?.length ? (
        <ul className="grid gap-1 text-sm text-text-muted">
          {batches.data.map((item) => (
            <li key={item.batch}>
              <span className="font-medium text-text">{item.batch}</span> ·{" "}
              {interpolate(copy.batchCounts, {
                candidate: item.candidate,
                approved: item.approved,
                rejected: item.rejected,
              })}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="review-batch">{copy.batchLabel}</Label>
          <NativeSelect id="review-batch" value={batch} onChange={(event) => filter(setBatch)(event.target.value)}>
            <option value="">{copy.anyBatch}</option>
            {(batches.data ?? []).map((item) => (
              <option key={item.batch} value={item.batch}>
                {item.batch}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="review-concept">{copy.missConcept}</Label>
          <NativeSelect
            id="review-concept"
            value={concept}
            onChange={(event) => filter(setConcept)(event.target.value)}
          >
            <option value="">{copy.anyConcept}</option>
            {concepts.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.slug}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="review-locale">{copy.phraseLocale}</Label>
          <NativeSelect id="review-locale" value={locale} onChange={(event) => filter(setLocale)(event.target.value)}>
            <option value="">{copy.anyLocale}</option>
            {LOCALES.map((item) => (
              <option key={item} value={item}>
                {copy[localeKey(item)]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {page.data ? (
        items.length ? (
          <div className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={allChosen}
                  onChange={() => setChosen(allChosen ? new Set() : new Set(items.map((item) => item.id)))}
                />
                {copy.selectAll}
              </label>
              <span className="text-text-muted">
                {interpolate(copy.candidatesTotal, {
                  shown: `${offset + 1}–${offset + items.length}`,
                  total: page.data.total,
                })}
              </span>
            </div>
            <ul className="grid gap-1.5" aria-label={copy.reviewTitle}>
              {items.map((item) => (
                <li key={item.id} className="rounded-control bg-surface-sunken px-3 py-2 text-sm">
                  <label className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <input type="checkbox" checked={chosen.has(item.id)} onChange={() => toggle(item.id)} />
                    <span className="font-medium" dir="auto">
                      {item.phrase}
                    </span>
                    <span className="text-text-muted">→ {item.concept}</span>
                    <Badge variant="secondary">{copy[localeKey(item.locale)]}</Badge>
                    {item.variant_of ? (
                      <span className="text-xs text-text-muted" dir="auto">
                        {interpolate(copy.spellingOf, { phrase: item.variant_of })}
                      </span>
                    ) : null}
                    {item.note.includes("also reads as") ? <Badge variant="warning">{copy.clash}</Badge> : null}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-text-muted">{interpolate(copy.selected, { count: chosen.size })}</span>
              <Button type="button" size="sm" disabled={busy || !chosen.size} onClick={() => void decide("approve")}>
                {copy.approveSelected}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !chosen.size}
                onClick={() => void decide("reject")}
              >
                {copy.rejectSelected}
              </Button>
              <span className="ms-auto flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={offset === 0}
                  onClick={() => {
                    setOffset(Math.max(0, offset - PAGE));
                    setChosen(new Set());
                  }}
                >
                  {copy.previous}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={offset + PAGE >= page.data.total}
                  onClick={() => {
                    setOffset(offset + PAGE);
                    setChosen(new Set());
                  }}
                >
                  {copy.next}
                </Button>
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">{copy.noCandidates}</p>
        )
      ) : page.failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : (
        <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden />
      )}
      {message ? (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
    </section>
  );
}

/** Releases of the language data: what is live, whether it is released, and each release's eval results. */
export function IntentReleases({ version }: { version: number }) {
  const copy = useAdminCatalogueCopy();
  const { locale } = useLocale();
  const state = useLoad(fetchReleases, `releases:${version}`);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const latest = state.data?.releases[0];
  const released = latest && latest.checksum === state.data?.current_checksum;

  async function release(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const made = await releaseIntentData(note.trim());
      setMessage({ tone: "success", text: made.name });
      setNote("");
      state.reload();
    } catch (caught) {
      const refused = caught instanceof ApiError && caught.status === 422;
      setMessage({ tone: "danger", text: refused ? copy.releaseRefused : errorText(caught, copy.loadError) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3" aria-labelledby="releases-heading">
      <div className="grid gap-1">
        <h2 id="releases-heading" className="font-semibold">
          {copy.releasesTitle}
        </h2>
        <p className="text-sm text-text-muted">{copy.releasesBody}</p>
      </div>
      {state.data ? (
        <p className="text-sm">
          {interpolate(released ? copy.upToDate : copy.unreleased, { count: state.data.approved_phrases })}
        </p>
      ) : null}
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void release(event)}>
        <div className="grid min-w-64 flex-1 gap-1.5">
          <Label htmlFor="release-note">{copy.releaseNote}</Label>
          <Input id="release-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
        </div>
        <Button type="submit" size="sm" disabled={busy || Boolean(released)}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {busy ? copy.releasing : copy.release}
        </Button>
      </form>
      {message ? (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
      {state.data?.releases.length ? (
        <ul className="grid gap-2">
          {state.data.releases.map((item) => (
            <li key={item.id} className="grid gap-1 rounded-control bg-surface-sunken px-3 py-2 text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="text-text-muted">
                  {formatDate(locale, item.released_at, { dateStyle: "medium" })} · {item.approved_phrases}
                </span>
                {item.note ? <span className="text-text-muted">· {item.note}</span> : null}
              </span>
              {Object.entries(item.metrics).map(([name, metrics]) => (
                <span key={name} className="text-text-muted">
                  {interpolate(copy.releaseMetrics, {
                    name: copy[`set_${name}` as AdminCatalogueKey] ?? name,
                    cases: metrics.cases,
                    accuracy: percent(metrics.case_accuracy),
                  })}
                </span>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
