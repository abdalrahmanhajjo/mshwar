"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/shell/locale-provider";
import {
  acceptReplacement,
  cancelReplacement,
  clarifyPlannerSession,
  createPlannerSession,
  fetchAlternatives,
  fetchTripVersions,
  formatMinor,
  lockPlannerStop,
  previewReplacement,
  refinePlannerSession,
  regeneratePlannerSession,
  type PlanDocument,
  type PlannerSession,
} from "@/lib/planner";
import { usePlannerCopy } from "@/lib/planner-copy";
import { interpolate } from "@/i18n/catalogues";

function priceKindLabel(kind: string, copy: ReturnType<typeof usePlannerCopy>) {
  if (kind === "quote") {
    return copy.quote;
  }
  if (kind === "fixed") {
    return copy.fromPrice;
  }
  return copy.estimated;
}

export function PlannerView({ initialTripId }: { initialTripId?: string }) {
  const copy = usePlannerCopy();
  const { locale } = useLocale();
  const [text, setText] = React.useState("");
  const [answer, setAnswer] = React.useState("");
  const [refine, setRefine] = React.useState("");
  const [session, setSession] = React.useState<PlannerSession | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [alts, setAlts] = React.useState<
    { experience_id: string; title: string; why_fit: string[]; sponsored: boolean }[]
  >([]);
  const [preview, setPreview] = React.useState<{
    preview_id: string;
    title: string;
    delta_cost_minor: number;
    delta_minutes: number;
    why_fit: string[];
  } | null>(null);
  const [interpretation, setInterpretation] = React.useState<string | null>(null);
  const [versions, setVersions] = React.useState<{ version: number; origin: string; sealed_at: string | null }[]>([]);
  const [replaceStopId, setReplaceStopId] = React.useState<string | null>(null);

  async function run(task: () => Promise<PlannerSession>) {
    setPending(true);
    setError(null);
    try {
      const next = await task();
      setSession(next);
      if (next.plan?.trip_id) {
        const history = await fetchTripVersions(next.plan.trip_id);
        setVersions(history);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.updateError);
    } finally {
      setPending(false);
    }
  }

  const plan = session?.plan ?? null;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.body}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {session?.degraded ? (
            <p role="status" className="rounded-control bg-warning/15 p-3 text-sm">
              {session.degraded_message || copy.degraded}
            </p>
          ) : null}
          <Label htmlFor="planner-intent">{copy.title}</Label>
          <Textarea
            id="planner-intent"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={copy.placeholder}
            rows={4}
          />
          <Button
            type="button"
            disabled={pending || text.trim().length < 2}
            onClick={() =>
              void run(() =>
                createPlannerSession({
                  text,
                  locale,
                  session_id: session?.session_id,
                }),
              )
            }
          >
            {copy.build}
          </Button>
          {session?.clarifications?.length ? (
            <div className="grid gap-3 rounded-control border border-border p-4">
              {session.clarifications.map((item) => (
                <p key={item.field} className="text-sm">
                  {item.prompt}
                </p>
              ))}
              <Input value={answer} onChange={(event) => setAnswer(event.target.value)} aria-label={copy.clarify} />
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !session.session_id}
                onClick={() =>
                  void run(() =>
                    clarifyPlannerSession(session.session_id, {
                      text,
                      locale,
                      answers: { intent_anchor: answer },
                    }),
                  )
                }
              >
                {copy.clarify}
              </Button>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {session?.assumed_defaults?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{copy.assumptions}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {session.assumed_defaults.map((item) => (
                <li key={item.field}>{item.label}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {session?.budget_warning ? (
        <p role="status" className="rounded-control bg-warning/15 p-3 text-sm">
          {session.budget_warning}
        </p>
      ) : null}

      {session?.forced_lock_changes?.length ? (
        <p role="status" className="text-sm">
          {session.forced_lock_changes.join(" ")}
        </p>
      ) : null}

      {plan ? (
        <Timeline plan={plan} copy={copy} sessionId={session?.session_id} onLock={run} onReplace={setReplaceStopId} />
      ) : null}
      {plan ? <CostPanel plan={plan} copy={copy} /> : null}

      {plan && session?.session_id ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => void run(() => regeneratePlannerSession(session.session_id))}
          >
            {copy.regenerate}
          </Button>
        </div>
      ) : null}

      {replaceStopId && session?.session_id ? (
        <ReplacePanel
          sessionId={session.session_id}
          stopId={replaceStopId}
          copy={copy}
          alts={alts}
          preview={preview}
          onAlts={setAlts}
          onPreview={setPreview}
          onClose={() => {
            setReplaceStopId(null);
            setPreview(null);
            setAlts([]);
          }}
          onAccept={(id) => void run(() => acceptReplacement(session.session_id, id))}
          onCancel={() => void cancelReplacement(session.session_id).then(() => setPreview(null))}
        />
      ) : null}

      {session?.session_id ? (
        <Card>
          <CardHeader>
            <CardTitle>{copy.refine}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Textarea value={refine} onChange={(event) => setRefine(event.target.value)} rows={3} />
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                void refinePlannerSession(session.session_id, refine, false).then((result) => {
                  setInterpretation(result.summary || result.clarification || null);
                });
              }}
            >
              {copy.refine}
            </Button>
            {interpretation ? <p className="text-sm">{interpretation}</p> : null}
            {interpretation && !interpretation.toLowerCase().includes("could not") ? (
              <Button
                type="button"
                disabled={pending}
                onClick={() => void run(() => refinePlannerSession(session.session_id, refine, true))}
              >
                {copy.apply}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {versions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{copy.versions}</CardTitle>
            {initialTripId ? (
              <CardDescription>{interpolate(copy.tripLabel, { id: initialTripId })}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <ol className="grid gap-2 text-sm">
              {versions.map((item) => (
                <li key={item.version}>
                  v{item.version} · {item.origin} {item.sealed_at ? `· ${copy.sealed}` : ""}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Timeline({
  plan,
  copy,
  sessionId,
  onLock,
  onReplace,
}: {
  plan: PlanDocument;
  copy: ReturnType<typeof usePlannerCopy>;
  sessionId?: string;
  onLock: (task: () => Promise<PlannerSession>) => Promise<void>;
  onReplace: (stopId: string) => void;
}) {
  const legsByPosition = new Map(plan.legs.map((leg) => [leg.position, leg]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.timeline}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {plan.stops.map((stop, index) => {
          const leg = legsByPosition.get(index);
          return (
            <article key={stop.id} className="grid gap-2 rounded-control border border-border p-4">
              {leg ? (
                <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                  {copy.travel} · {Math.round((leg.duration_seconds || 0) / 60)} min · {leg.provider}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-title font-semibold">{stop.snapshot.title || stop.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {stop.snapshot.sponsored ? (
                    <Badge variant="accent">{stop.snapshot.sponsored_label || copy.sponsored}</Badge>
                  ) : null}
                  <Badge variant="secondary">{priceKindLabel(stop.price_kind, copy)}</Badge>
                  {stop.locked ? <Badge variant="warning">{copy.lock}</Badge> : null}
                </div>
              </div>
              <p className="text-sm text-text-muted">
                {new Date(stop.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                {new Date(stop.ends_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                {formatMinor(stop.estimated_minor, plan.currency)}
              </p>
              {stop.snapshot.explanation ? (
                <p className="text-sm">
                  {copy.why}: {stop.snapshot.explanation}
                </p>
              ) : null}
              <p className="text-xs text-text-muted">
                {copy.booking}: {stop.booking_mode || "request"}
              </p>
              {sessionId ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void onLock(() => lockPlannerStop(sessionId, stop.id, !stop.locked))}
                  >
                    {stop.locked ? copy.unlock : copy.lock}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => onReplace(stop.id)}>
                    {copy.replace}
                  </Button>
                </div>
              ) : null}
            </article>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CostPanel({ plan, copy }: { plan: PlanDocument; copy: ReturnType<typeof usePlannerCopy> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.cost}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {plan.stops.map((stop) => (
          <div key={stop.id} className="flex justify-between gap-3">
            <span>
              {stop.snapshot.title || stop.title} · {priceKindLabel(stop.price_kind, copy)}
              {stop.snapshot.price_source ? ` · ${stop.snapshot.price_source}` : ""}
            </span>
            <span>{formatMinor(stop.estimated_minor, plan.currency)}</span>
          </div>
        ))}
        {plan.cost_items.map((item) => (
          <div key={item.label} className="flex justify-between gap-3">
            <span>{item.label}</span>
            <span>{formatMinor(item.amount_minor, plan.currency)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 font-semibold">
          <span>{copy.total}</span>
          <span>{formatMinor(plan.total_minor, plan.currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function ReplacePanel({
  sessionId,
  stopId,
  copy,
  alts,
  preview,
  onAlts,
  onPreview,
  onClose,
  onAccept,
  onCancel,
}: {
  sessionId: string;
  stopId: string;
  copy: ReturnType<typeof usePlannerCopy>;
  alts: { experience_id: string; title: string; why_fit: string[]; sponsored: boolean }[];
  preview: {
    preview_id: string;
    title: string;
    delta_cost_minor: number;
    delta_minutes: number;
    why_fit: string[];
  } | null;
  onAlts: (rows: { experience_id: string; title: string; why_fit: string[]; sponsored: boolean }[]) => void;
  onPreview: (row: {
    preview_id: string;
    title: string;
    delta_cost_minor: number;
    delta_minutes: number;
    why_fit: string[];
  }) => void;
  onClose: () => void;
  onAccept: (previewId: string) => void;
  onCancel: () => void;
}) {
  React.useEffect(() => {
    void fetchAlternatives(sessionId, stopId).then(onAlts);
  }, [sessionId, stopId, onAlts]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.replace}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {alts.map((item) => (
          <div key={item.experience_id} className="grid gap-1 rounded-control border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{item.title}</p>
              {item.sponsored ? <Badge variant="accent">{copy.sponsored}</Badge> : null}
            </div>
            <p className="text-xs text-text-muted">{item.why_fit.join(" · ")}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void previewReplacement(sessionId, stopId, item.experience_id).then((row) =>
                  onPreview({
                    preview_id: row.preview_id,
                    title: row.title,
                    delta_cost_minor: row.delta_cost_minor,
                    delta_minutes: row.delta_minutes,
                    why_fit: row.why_fit,
                  }),
                )
              }
            >
              Preview
            </Button>
          </div>
        ))}
        {preview ? (
          <div className="grid gap-2 rounded-control bg-surface-sunken p-3 text-sm">
            <p>
              {preview.title}: {preview.delta_minutes} min, {formatMinor(preview.delta_cost_minor)}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => onAccept(preview.preview_id)}>
                {copy.accept}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                {copy.cancel}
              </Button>
            </div>
          </div>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose}>
          {copy.cancel}
        </Button>
      </CardContent>
    </Card>
  );
}
