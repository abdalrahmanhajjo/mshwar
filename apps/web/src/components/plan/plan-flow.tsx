"use client";

import * as React from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Sparkles,
  Users,
  Wallet,
  Wand2,
  X,
} from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { DayBuilder } from "@/components/plan/day-builder";
import { useDayCheck } from "@/components/plan/day-panel";
import { DriverRequestPanel } from "@/components/planner/day-cost";
import { DayTimeline } from "@/components/planner/day-timeline";
import { SavePlan } from "@/components/planner/save-plan";
import { UnderstoodSteps } from "@/components/planner/understood-steps";
import { CostPanel, ReplacePanel, Timeline, plannerErrorMessage } from "@/components/planner/planner-view";
import {
  acceptReplacement,
  cancelReplacement,
  clarifyPlannerSession,
  createManualPlan,
  createPlannerSession,
  fetchTripVersions,
  fetchVersion,
  refinePlannerSession,
  regeneratePlannerSession,
  dayOf,
  dayPriceOf,
  type PlannerSession,
} from "@/lib/planner";
import { apiRequest } from "@/lib/api/client";
import { listingFromApi } from "@/lib/catalogue-api";
import type { Destination, Experience } from "@/lib/catalog";
import { usePlannerCopy } from "@/lib/planner-copy";
import { useCheckoutCopy } from "@/lib/checkout-copy";
import { interpolate } from "@/i18n/catalogues";
import { splitSentence } from "@/lib/text";
import { cn, focusRing } from "@/lib/utils";

type ApiListingItem = Parameters<typeof listingFromApi>[0];

type Mode = "ai" | "manual";
type Step = "destination" | "places" | "details" | "review";

function stepsFor(mode: Mode): Step[] {
  // Manual: the date and the group decide opening hours, traffic and the driving
  // estimate, so they are settled before the traveller starts picking places.
  return mode === "manual" ? ["destination", "details", "places", "review"] : ["destination", "details", "review"];
}

const DEFAULT_START_TIME = "09:00";
const DEFAULT_END_TIME = "18:00";

/** The Beirut date and time of an ISO instant, as the date and time inputs want them. */
function beirutParts(iso: unknown): { date: string; time: string } | null {
  if (typeof iso !== "string" || !iso) {
    return null;
  }
  const moment = new Date(iso);
  if (Number.isNaN(moment.getTime())) {
    return null;
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Beirut",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(moment)
      .map((part) => [part.type, part.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** The day after an ISO date, for a "back by" that falls after midnight. */
function nextDayIso(date: string) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);

function tomorrowIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function PlanFlow({
  destinations,
  initialTripId,
  collectionTitle,
  addSlug,
  addDestination,
}: {
  destinations: Destination[];
  initialTripId?: string;
  collectionTitle?: string;
  addSlug?: string;
  addDestination?: string;
}) {
  const copy = usePlannerCopy();
  const checkout = useCheckoutCopy();
  const { locale } = useLocale();
  const [lead, tail] = splitSentence(copy.pageTitle);

  const [mode, setMode] = React.useState<Mode>("ai");
  const [step, setStep] = React.useState<Step>(() => (initialTripId ? "review" : "destination"));
  const [destSlugs, setDestSlugs] = React.useState<string[]>([]);
  const [date, setDate] = React.useState<string>(tomorrowIso);
  const [startTime, setStartTime] = React.useState<string>(DEFAULT_START_TIME);
  const [endTime, setEndTime] = React.useState<string>(DEFAULT_END_TIME);
  // Where the day starts. Unset means the planner's default; an edited AI plan keeps its own.
  // Stop lengths an edited AI plan brings along, by slug; new picks use their own.
  const [stopMinutes, setStopMinutes] = React.useState<Record<string, number>>({});
  const [startPoint, setStartPoint] = React.useState<{ lat: number; lng: number } | null>(null);
  const [party, setParty] = React.useState<number>(2);
  const [budget, setBudget] = React.useState<number>(200);
  const [strict, setStrict] = React.useState<boolean>(false);
  const [vibe, setVibe] = React.useState<string>("");

  // Manual mode
  const [placeOptions, setPlaceOptions] = React.useState<Experience[]>([]);
  const [loadingPlaces, setLoadingPlaces] = React.useState(false);
  const [picks, setPicks] = React.useState<Experience[]>([]);
  const [manualTripId, setManualTripId] = React.useState<string | undefined>(undefined);
  const [acceptWarnings, setAcceptWarnings] = React.useState(false);
  // Set while an AI plan is being edited by hand: how many of its stops could not come along.
  const [editingAi, setEditingAi] = React.useState<{ dropped: number } | null>(null);

  const [session, setSession] = React.useState<PlannerSession | null>(null);
  const [versions, setVersions] = React.useState<{ version: number; origin: string; sealed_at: string | null }[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refine, setRefine] = React.useState("");
  // What the planner understood from the last change request, shown under the box.
  const [refineNote, setRefineNote] = React.useState<string | null>(null);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [replaceStopId, setReplaceStopId] = React.useState<string | null>(null);
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

  const plan = session?.plan ?? null;
  const daySteps = dayOf(session, plan);
  const sessionId = session?.session_id || undefined;
  const selectedDestination = destinations.find((item) => item.slug === destSlugs[0]) ?? null;
  const windowStart = `${date}T${startTime}:00`;
  // A "back by" at or before the start time means after midnight.
  const returnBy = `${endTime > startTime ? date : nextDayIso(date)}T${endTime}:00`;
  const keptMinutes = Object.fromEntries(
    picks.filter((item) => stopMinutes[item.slug]).map((item) => [item.slug, stopMinutes[item.slug] as number]),
  );
  const {
    preview: dayPreview,
    checking: dayChecking,
    failed: dayCheckFailed,
  } = useDayCheck({
    slugs: picks.map((item) => item.slug),
    destinationSlugs: Array.from(new Set(picks.map((item) => item.destinationSlug).filter(Boolean))),
    partySize: party,
    windowStart,
    returnBy,
    stopMinutes: keptMinutes,
    startLat: startPoint?.lat,
    startLng: startPoint?.lng,
    budgetMinor: Math.round(budget * 100),
    strictBudget: strict,
    locale,
  });
  const dayBlocked = Boolean(dayPreview?.feasibility && !dayPreview.feasibility.feasible);

  // Reopening a saved trip: load its latest version read-only and jump to review.
  React.useEffect(() => {
    if (!initialTripId) {
      return;
    }
    let cancelled = false;
    void fetchTripVersions(initialTripId)
      .then(async (history) => {
        if (cancelled) {
          return;
        }
        setVersions(history);
        if (!history.length) {
          return;
        }
        const latest = history.reduce((best, item) => (item.version > best.version ? item : best));
        const doc = await fetchVersion(latest.version_id);
        if (cancelled) {
          return;
        }
        setSession({
          session_id: "",
          status: "loaded",
          degraded: false,
          degraded_message: null,
          constraints: doc.constraints ?? {},
          assumed_defaults: [],
          clarifications: [],
          plan: doc,
        });
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(plannerErrorMessage(caught, copy));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialTripId, copy]);

  // Deep-link from a place: pre-load it into a manual plan (opened in this tab).
  React.useEffect(() => {
    if (!addSlug || initialTripId) {
      return;
    }
    let cancelled = false;
    type ApiListingItem = Parameters<typeof listingFromApi>[0];
    void apiRequest<ApiListingItem>(`/api/v1/catalogue/experiences/${encodeURIComponent(addSlug)}`)
      .then(async (row) => {
        if (cancelled) {
          return;
        }
        const exp = listingFromApi(row);
        const destination = addDestination || exp.destinationSlug;
        setMode("manual");
        setDestSlugs(destination ? [destination] : []);
        setPicks([exp]);
        setStep("places");
        if (destination) {
          setLoadingPlaces(true);
          try {
            const search = new URLSearchParams({ destination, page: "1", pageSize: "48" });
            const data = await apiRequest<{ items: ApiListingItem[] }>(`/api/v1/catalogue/experiences?${search}`);
            if (!cancelled) {
              setPlaceOptions(data.items.map(listingFromApi));
            }
          } catch {
            if (!cancelled) {
              setPlaceOptions([]);
            }
          } finally {
            if (!cancelled) {
              setLoadingPlaces(false);
            }
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [addSlug, addDestination, initialTripId]);

  async function run(task: () => Promise<PlannerSession>) {
    setPending(true);
    setError(null);
    try {
      const next = await task();
      setSession(next);
      if (next.plan?.trip_id) {
        setManualTripId(next.plan.trip_id);
        setVersions(await fetchTripVersions(next.plan.trip_id));
      }
    } catch (caught) {
      setError(plannerErrorMessage(caught, copy));
    } finally {
      setPending(false);
    }
  }

  // Each step opens at the top of the page, not wherever the last one was scrolled to.
  const firstStep = React.useRef(true);
  React.useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }, [step]);

  /** Ask for a change in words: the planner reads it first, then applies what it understood. */
  async function applyRefine() {
    const text = refine.trim();
    if (!sessionId || !text) {
      return;
    }
    setError(null);
    setRefineNote(null);
    setPending(true);
    let understood: Awaited<ReturnType<typeof refinePlannerSession>>;
    try {
      understood = await refinePlannerSession(sessionId, text, false);
    } catch (caught) {
      setError(plannerErrorMessage(caught, copy));
      setPending(false);
      return;
    }
    if (!understood.understood) {
      setRefineNote(understood.clarification || copy.refineUnclear);
      setPending(false);
      return;
    }
    setRefineNote(understood.summary ?? null);
    await run(() => refinePlannerSession(sessionId, text, true));
    setRefine("");
  }

  async function generate() {
    if (!selectedDestination) {
      return;
    }
    const answers: Record<string, unknown> = {
      intent_anchor: selectedDestination.slug,
      party_size: party,
      window_start: windowStart,
      budget_minor: Math.round(budget * 100),
      strict_budget: strict,
    };
    const text = vibe.trim() || `A day in ${selectedDestination.name}`;
    setSession(null);
    setAnswers({});
    setStep("review");
    await run(() => createPlannerSession({ text, locale, answers }));
  }

  async function saveManual() {
    if (!picks.length) {
      return;
    }
    const destinationSlugs = Array.from(new Set(picks.map((item) => item.destinationSlug)));
    setSession(null);
    setStep("review");
    await run(() =>
      createManualPlan({
        experience_slugs: picks.map((item) => item.slug),
        destination_slugs: destinationSlugs,
        party_size: party,
        window_start: windowStart,
        return_by: returnBy,
        stop_minutes: keptMinutes,
        start_lat: startPoint?.lat,
        start_lng: startPoint?.lng,
        budget_minor: Math.round(budget * 100),
        strict_budget: strict,
        currency: "USD",
        trip_id: manualTripId,
        locale,
        accept_warnings: acceptWarnings,
      }),
    );
  }

  async function editManually() {
    if (!plan) {
      return;
    }
    const slugs = plan.stops
      .map((stop) => stop.snapshot.slug ?? stop.slug)
      .filter((slug): slug is string => Boolean(slug));
    if (!slugs.length) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const resolved = await Promise.all(
        slugs.map((slug) =>
          apiRequest<ApiListingItem>(`/api/v1/catalogue/experiences/${encodeURIComponent(slug)}`)
            .then(listingFromApi)
            .catch(() => null),
        ),
      );
      const picksResolved = resolved.filter((item): item is Experience => item !== null);
      if (!picksResolved.length) {
        setError(copy.flowNoPlanHint);
        return;
      }
      // Keep the AI day's own window, start point, group and budget: the manual check
      // must judge the same day the AI planned, not a default 09:00-18:00 one.
      const kept: Record<string, unknown> = {
        ...(session?.constraints ?? {}),
        ...(plan.constraints ?? {}),
        window_start: plan.window_start,
        return_by: plan.return_by,
        party_size: plan.party_size,
        budget_minor: plan.budget_minor,
      };
      const minutes: Record<string, number> = {};
      for (const stop of plan.stops) {
        const slug = stop.snapshot.slug ?? stop.slug;
        const length = (new Date(stop.ends_at).getTime() - new Date(stop.starts_at).getTime()) / 60000;
        if (slug && Number.isFinite(length) && length > 0) {
          minutes[slug] = Math.round(length);
        }
      }
      setStopMinutes(minutes);
      const from = beirutParts(kept.window_start);
      const until = beirutParts(kept.return_by);
      if (from) {
        setDate(from.date);
        setStartTime(from.time);
      }
      if (until) {
        setEndTime(until.time);
      }
      const lat = asNumber(kept.start_lat);
      const lng = asNumber(kept.start_lng);
      setStartPoint(lat !== undefined && lng !== undefined ? { lat, lng } : null);
      const keptParty = asNumber(kept.party_size);
      if (keptParty) {
        setParty(keptParty);
      }
      const keptBudget = asNumber(kept.budget_minor);
      if (keptBudget !== undefined) {
        setBudget(Math.round(keptBudget / 100));
      }
      // Every town the AI day touched, so all of its stops stay editable side by side.
      const towns = Array.from(new Set(picksResolved.map((item) => item.destinationSlug).filter(Boolean)));
      setPicks(picksResolved);
      setMode("manual");
      setManualTripId(plan.trip_id);
      setAcceptWarnings(false);
      setEditingAi({ dropped: plan.stops.length - picksResolved.length });
      setDestSlugs(towns);
      await openPlaces(towns);
    } finally {
      setPending(false);
    }
  }

  async function openPlaces(towns: string[] = destSlugs) {
    setStep("places");
    if (!towns.length) {
      return;
    }
    setLoadingPlaces(true);
    try {
      // One request per town, so a single day can mix places from several of them.
      const pages = await Promise.all(
        towns.map((slug) => {
          const search = new URLSearchParams({ destination: slug, page: "1", pageSize: "48" });
          return apiRequest<{ items: ApiListingItem[] }>(`/api/v1/catalogue/experiences?${search}`).catch(() => ({
            items: [] as ApiListingItem[],
          }));
        }),
      );
      const seen = new Set<string>();
      const merged: Experience[] = [];
      for (const page of pages) {
        for (const row of page.items) {
          const listing = listingFromApi(row);
          if (!seen.has(listing.slug)) {
            seen.add(listing.slug);
            merged.push(listing);
          }
        }
      }
      setPlaceOptions(merged);
    } catch {
      setPlaceOptions([]);
    } finally {
      setLoadingPlaces(false);
    }
  }

  function toggleDestination(slug: string) {
    setDestSlugs((current) => {
      if (mode === "ai") {
        return [slug];
      }
      return current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
    });
  }

  /** Put the picks into the order the feasibility check says drives least. */
  function applyOrder(slugs: string[]) {
    setPicks((current) => {
      const bySlug = new Map(current.map((item) => [item.slug, item]));
      const ordered = slugs.map((slug) => bySlug.get(slug)).filter((item): item is Experience => Boolean(item));
      const rest = current.filter((item) => !slugs.includes(item.slug));
      return [...ordered, ...rest];
    });
    setAcceptWarnings(false);
  }

  /** Keep the first suggested cluster; the rest stay in the catalogue for another day. */
  function keepFirstDay(slugs: string[]) {
    setPicks((current) => current.filter((item) => slugs.includes(item.slug)));
    setAcceptWarnings(false);
  }

  function clearPicks() {
    setPicks([]);
    setAcceptWarnings(false);
  }

  function togglePick(exp: Experience) {
    setAcceptWarnings(false);
    setPicks((current) =>
      current.some((item) => item.slug === exp.slug)
        ? current.filter((item) => item.slug !== exp.slug)
        : [...current, exp],
    );
  }

  function movePick(index: number, direction: -1 | 1) {
    setAcceptWarnings(false);
    setPicks((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) {
        return current;
      }
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function startOver() {
    setSession(null);
    setVersions([]);
    setError(null);
    setReplaceStopId(null);
    setPreview(null);
    setAlts([]);
    setRefine("");
    setAnswers({});
    setPicks([]);
    setPlaceOptions([]);
    setDestSlugs([]);
    setManualTripId(undefined);
    setAcceptWarnings(false);
    setEditingAi(null);
    setStartPoint(null);
    setStopMinutes({});
    setStep("destination");
  }

  function switchMode(next: Mode) {
    if (next === mode) {
      return;
    }
    setMode(next);
    setSession(null);
    setPicks([]);
    setDestSlugs((current) => (next === "ai" ? current.slice(0, 1) : current));
    setManualTripId(undefined);
    setAcceptWarnings(false);
    setEditingAi(null);
    setStartPoint(null);
    setStopMinutes({});
    setError(null);
    setStep("destination");
  }

  const order = stepsFor(mode);
  const activeIndex = order.indexOf(step);
  const stepLabel = (item: Step) =>
    item === "destination"
      ? copy.flowStepDestination
      : item === "places"
        ? copy.flowStepPlaces
        : item === "details"
          ? mode === "manual"
            ? copy.flowStepSettings
            : copy.flowStepDetails
          : copy.flowStepReview;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.plannerKicker}
        icon={<Sparkles aria-hidden />}
        title={lead}
        accent={tail || undefined}
        description={copy.pageBody}
      />

      {!initialTripId ? (
        <div className="grid gap-6">
          <div
            role="tablist"
            aria-label={copy.flowStepReview}
            className="grid grid-cols-2 gap-2 rounded-card border border-border-subtle bg-surface-sunken p-1.5 sm:max-w-md"
          >
            {(["ai", "manual"] as Mode[]).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={mode === item}
                disabled={pending}
                onClick={() => switchMode(item)}
                className={cn(
                  "grid gap-0.5 rounded-control px-4 py-2.5 text-start transition-colors",
                  mode === item ? "bg-surface-raised shadow-sm" : "hover:bg-surface-raised/60",
                  focusRing,
                )}
              >
                <span className="flex items-center gap-2 font-semibold">
                  {item === "ai" ? (
                    <Sparkles className="size-4" aria-hidden />
                  ) : (
                    <Pencil className="size-4" aria-hidden />
                  )}
                  {item === "ai" ? copy.modeAi : copy.modeManual}
                </span>
                <span className="text-xs text-text-muted">{item === "ai" ? copy.modeAiHint : copy.modeManualHint}</span>
              </button>
            ))}
          </div>

          <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm sm:gap-2" aria-label={copy.flowStepReview}>
            {order.map((item, index) => {
              const done = index < activeIndex;
              const current = index === activeIndex;
              return (
                <li key={item} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 font-medium",
                      current
                        ? "border-brand bg-brand text-white"
                        : done
                          ? "border-brand/40 bg-brand-subtle text-brand"
                          : "border-border-subtle bg-surface text-text-muted",
                    )}
                  >
                    <span className="grid size-5 place-items-center rounded-full bg-white/20 text-xs tabular-nums">
                      {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                    </span>
                    {/* On a phone only the current step is named, so the row never outgrows the screen. */}
                    <span className={cn(!current && "sr-only sm:not-sr-only")}>{stepLabel(item)}</span>
                  </span>
                  {index < order.length - 1 ? <span className="h-px w-3 bg-border-subtle sm:w-5" aria-hidden /> : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {addSlug ? (
        <Notice role="status">
          <span className="flex flex-wrap items-center justify-between gap-3">
            {collectionTitle ?? addSlug}
            <Button asChild size="sm" variant="accent">
              <LocaleLink href={`/checkout?listing=${addSlug}&source=itinerary`}>
                {checkout.bookThisStop}
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
              </LocaleLink>
            </Button>
          </span>
        </Notice>
      ) : null}

      {step === "destination" && !initialTripId ? (
        <section aria-labelledby="pf-dest" className="grid gap-6">
          <div className="grid gap-2">
            <h2 id="pf-dest" className="title-section">
              {copy.flowChooseTitle}
            </h2>
            <p className="max-w-2xl text-text-muted">
              {mode === "manual" ? copy.flowMultiDestHint : copy.flowChooseHint}
            </p>
          </div>
          {mode === "manual" && destSlugs.length ? (
            // What is chosen, and one tap to undo any of it — a pressed card alone
            // is easy to lose track of once the grid scrolls.
            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
              <span className="text-sm font-medium text-text-muted">
                {interpolate(copy.flowDestinationsChosen, { n: destSlugs.length })}
              </span>
              {destinations
                .filter((item) => destSlugs.includes(item.slug))
                .map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    onClick={() => toggleDestination(item.slug)}
                    aria-label={`${copy.flowRemove}: ${item.name}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-pill border border-brand/40 bg-brand-subtle px-3 py-1.5 text-sm font-medium text-brand transition-colors hover:bg-brand/15",
                      focusRing,
                    )}
                  >
                    {item.name}
                    <X className="size-3.5" aria-hidden />
                  </button>
                ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-text-muted"
                onClick={() => setDestSlugs([])}
              >
                {copy.flowClearTowns}
              </Button>
            </div>
          ) : null}
          {destinations.length ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {destinations.map((item) => {
                  const active = destSlugs.includes(item.slug);
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      aria-pressed={active}
                      aria-label={item.name}
                      onClick={() => toggleDestination(item.slug)}
                      className={cn(
                        "group relative grid overflow-hidden rounded-card border bg-surface-raised text-start shadow-sm transition-all hover:shadow-md",
                        active ? "border-brand ring-2 ring-brand/40" : "border-border-subtle",
                        focusRing,
                      )}
                    >
                      <span className="relative block aspect-[16/10] overflow-hidden">
                        <CatalogImage src={item.image} alt={item.imageAlt} />
                        {active ? (
                          <span className="absolute end-3 top-3 grid size-7 place-items-center rounded-full bg-brand text-white shadow">
                            <Check className="size-4" aria-hidden />
                          </span>
                        ) : null}
                      </span>
                      <span className="grid gap-1 p-4">
                        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-text-muted">
                          <MapPin className="size-3.5" aria-hidden />
                          {item.region}
                        </span>
                        <span className="title-card text-[1.15rem]">{item.name}</span>
                        <span className="line-clamp-2 text-sm text-text-muted">{item.blurb}</span>
                        {item.experienceCount ? (
                          <span className="text-xs font-medium text-text-muted">
                            {interpolate(copy.destinationPlaces, { n: item.experienceCount })}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button type="button" size="lg" disabled={!destSlugs.length} onClick={() => setStep("details")}>
                  {mode === "manual" ? copy.flowContinueToDetails : copy.flowContinue}
                </Button>
              </div>
            </>
          ) : (
            <Notice role="status">{copy.flowNoDestinations}</Notice>
          )}
        </section>
      ) : null}

      {step === "places" && mode === "manual" && !initialTripId ? (
        <DayBuilder
          places={placeOptions}
          loading={loadingPlaces}
          picks={picks}
          towns={destinations.filter((item) => destSlugs.includes(item.slug))}
          preview={dayPreview}
          checking={dayChecking}
          failed={dayCheckFailed}
          notice={
            editingAi ? (
              <Notice role="status">
                <span className="grid gap-1">
                  <span>{copy.flowEditingAi}</span>
                  {editingAi.dropped > 0 ? (
                    <span className="text-text-muted">
                      {interpolate(copy.flowEditDropped, { n: editingAi.dropped })}
                    </span>
                  ) : null}
                </span>
              </Notice>
            ) : null
          }
          copy={copy}
          locale={locale}
          onToggle={togglePick}
          onMove={movePick}
          onReorder={applyOrder}
          onSplit={keepFirstDay}
          onClear={clearPicks}
          onBack={() => setStep("details")}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="lg"
                disabled={pending || !picks.length || (dayBlocked && !acceptWarnings)}
                onClick={() => void saveManual()}
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                {pending ? copy.flowSaving : copy.flowSave}
              </Button>
              {dayBlocked && !acceptWarnings ? (
                <Button type="button" size="lg" variant="outline" onClick={() => setAcceptWarnings(true)}>
                  {copy.daySaveAnyway}
                </Button>
              ) : null}
            </div>
          }
        />
      ) : null}

      {step === "details" && !initialTripId ? (
        <section aria-labelledby="pf-details" className="grid max-w-2xl gap-6">
          <div className="grid gap-2">
            <h2 id="pf-details" className="title-section">
              {copy.flowDetailsTitle}
            </h2>
            <p className="text-text-muted">{copy.flowDetailsHint}</p>
          </div>
          {selectedDestination ? (
            <p className="inline-flex w-fit items-center gap-2 rounded-control bg-surface-sunken px-3.5 py-2.5 text-sm">
              <MapPin className="size-4 text-accent-strong" aria-hidden />
              <span className="font-medium">{selectedDestination.name}</span>
              {mode === "manual" ? (
                <span className="text-text-muted">· {interpolate(copy.flowSelectedCount, { n: picks.length })}</span>
              ) : null}
            </p>
          ) : null}
          <div className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-6 shadow-sm md:p-7">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {copy.flowDateLabel}
                </span>
                <Input type="date" value={date} min={tomorrowIso()} onChange={(event) => setDate(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden />
                  {copy.flowPartyLabel}
                </span>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={party}
                  onChange={(event) => setParty(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="size-4" aria-hidden />
                  {copy.flowBudgetLabel}
                </span>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={budget}
                  onChange={(event) => setBudget(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
              <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm">
                <input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} />
                {copy.flowStrictLabel}
              </label>
              {mode === "manual" ? (
                <>
                  <label className="grid gap-2 text-sm font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-4" aria-hidden />
                      {copy.flowStartTimeLabel}
                    </span>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(event) => setStartTime(event.target.value || DEFAULT_START_TIME)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="size-4" aria-hidden />
                      {copy.flowEndTimeLabel}
                    </span>
                    <Input
                      type="time"
                      value={endTime}
                      aria-describedby="pf-end-hint"
                      onChange={(event) => setEndTime(event.target.value || DEFAULT_END_TIME)}
                    />
                    <span id="pf-end-hint" className="text-xs font-normal text-text-muted">
                      {copy.flowEndTimeHint}
                    </span>
                  </label>
                </>
              ) : null}
            </div>
            {mode === "ai" ? (
              <div className="grid gap-2">
                <Label htmlFor="pf-vibe">{copy.flowVibeLabel}</Label>
                <Textarea
                  id="pf-vibe"
                  rows={3}
                  value={vibe}
                  placeholder={copy.flowVibePlaceholder}
                  onChange={(event) => setVibe(event.target.value)}
                />
                <UnderstoodSteps text={vibe} copy={copy} onRewrite={setVibe} />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep("destination")}>
              <ChevronLeft className="rtl:-scale-x-100" aria-hidden />
              {copy.flowBack}
            </Button>
            {mode === "ai" ? (
              <Button type="button" size="lg" disabled={pending} onClick={() => void generate()}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
                {pending ? copy.flowGenerating : copy.flowGenerate}
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={() => void openPlaces()}>
                {copy.flowContinueToPlaces}
              </Button>
            )}
          </div>
        </section>
      ) : null}

      {step === "review" ? (
        <section aria-labelledby="pf-review" className="grid gap-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-2">
              <h2 id="pf-review" className="title-section">
                {copy.flowReviewTitle}
              </h2>
              {plan ? (
                <p className="max-w-2xl text-text-muted">
                  {initialTripId
                    ? copy.savedPlanNote
                    : mode === "manual"
                      ? copy.flowManualReviewHint
                      : copy.flowReviewHint}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {plan && mode === "manual" && !initialTripId ? (
                <Button type="button" variant="outline" onClick={() => setStep("places")}>
                  <Pencil aria-hidden />
                  {copy.flowAddMore}
                </Button>
              ) : null}
              {plan && mode === "ai" ? (
                <Button type="button" variant="outline" disabled={pending} onClick={() => void editManually()}>
                  <Pencil aria-hidden />
                  {copy.flowEditManual}
                </Button>
              ) : null}
              {!initialTripId ? (
                <Button type="button" variant="outline" disabled={pending} onClick={startOver}>
                  <RefreshCw aria-hidden />
                  {copy.flowStartOver}
                </Button>
              ) : null}
            </div>
          </div>

          {pending && !plan ? (
            <div className="grid place-items-center gap-3 rounded-card border border-border-subtle bg-surface-raised p-12 text-center">
              <Loader2 className="size-8 animate-spin text-brand" aria-hidden />
              <p className="font-medium">{mode === "manual" ? copy.flowSaving : copy.flowGenerating}</p>
            </div>
          ) : null}

          {session?.degraded ? <Notice tone="warning">{copy.degraded}</Notice> : null}

          {!pending && !plan && !initialTripId ? (
            <Card>
              <CardHeader>
                <CardTitle>{session?.clarifications.length ? copy.clarify : copy.flowNoPlanTitle}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {session?.clarifications.length ? (
                  <form
                    className="grid gap-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void run(() =>
                        clarifyPlannerSession(session.session_id, {
                          text: vibe.trim() || `A day in ${selectedDestination?.name ?? "Lebanon"}`,
                          locale,
                          answers: {
                            party_size: party,
                            window_start: windowStart,
                            budget_minor: Math.round(budget * 100),
                            strict_budget: strict,
                            ...answers,
                          },
                        }),
                      );
                    }}
                  >
                    {session.clarifications.map((question) => (
                      <label key={question.field} className="grid gap-2 text-sm font-medium">
                        {question.prompt}
                        <Input
                          value={answers[question.field] ?? ""}
                          required={question.required}
                          onChange={(event) =>
                            setAnswers((current) => ({ ...current, [question.field]: event.target.value }))
                          }
                        />
                      </label>
                    ))}
                    <Button type="submit" className="w-fit">
                      {copy.clarify}
                    </Button>
                  </form>
                ) : (
                  <p role="status" className="max-w-2xl text-text-muted">
                    {copy.flowNoPlanHint}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setStep("details")}>
                    <Pencil aria-hidden />
                    {copy.flowEditDetails}
                  </Button>
                  {mode === "ai" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMode("manual");
                        setError(null);
                        void openPlaces();
                      }}
                    >
                      {copy.modeManual}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {plan?.trip_id ? <SavePlan tripId={plan.trip_id} title={plan.trip_title} copy={copy} /> : null}

          {daySteps.length ? (
            <DayTimeline
              steps={daySteps}
              plan={plan}
              copy={copy}
              sessionId={plan ? sessionId : undefined}
              onLock={run}
            />
          ) : null}

          {plan ? (
            <>
              {!daySteps.length ? (
                <Timeline plan={plan} copy={copy} sessionId={sessionId} onLock={run} onReplace={setReplaceStopId} />
              ) : null}
              <CostPanel plan={plan} copy={copy} pricing={dayPriceOf(session, plan)} />
              {session?.driver_request && sessionId ? <DriverRequestPanel sessionId={sessionId} copy={copy} /> : null}

              {sessionId ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => void run(() => regeneratePlannerSession(sessionId))}
                  >
                    <RefreshCw aria-hidden />
                    {pending ? copy.flowRegenerating : copy.regenerate}
                  </Button>
                </div>
              ) : null}

              {replaceStopId && sessionId ? (
                <ReplacePanel
                  sessionId={sessionId}
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
                  onAccept={(id) => void run(() => acceptReplacement(sessionId, id))}
                  onCancel={() => void cancelReplacement(sessionId).then(() => setPreview(null))}
                />
              ) : null}

              {sessionId ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{copy.refine}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    <Textarea
                      value={refine}
                      onChange={(event) => setRefine(event.target.value)}
                      rows={3}
                      aria-label={copy.refine}
                    />
                    {refineNote ? <Notice role="status">{refineNote}</Notice> : null}
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" disabled={pending || !refine.trim()} onClick={() => void applyRefine()}>
                        <Wand2 aria-hidden />
                        {copy.apply}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {versions.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{copy.versions}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="grid gap-2 text-sm">
                      {versions.map((item) => (
                        <li
                          key={item.version}
                          className="flex items-center justify-between gap-3 rounded-control bg-surface-sunken px-3.5 py-2.5"
                        >
                          <span className="font-medium">
                            v{item.version} · {item.origin}
                          </span>
                          {item.sealed_at ? <Badge variant="secondary">{copy.sealed}</Badge> : null}
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              ) : null}

              <details className="group rounded-card border border-border-subtle bg-surface-raised">
                <summary
                  className={cn(
                    "flex cursor-pointer list-none items-center justify-between gap-3 p-5 font-medium",
                    focusRing,
                  )}
                >
                  <span className="grid gap-1">
                    <span className="title-card text-[1.15rem]">{copy.flowAdvancedTitle}</span>
                    <span className="text-sm font-normal text-text-muted">{copy.flowAdvancedHint}</span>
                  </span>
                  <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="grid gap-8 border-t border-border-subtle p-5 md:p-6">
                  {plan.trip_id ? (
                    <Button asChild variant="outline" className="w-fit">
                      <LocaleLink href={`/trips/${plan.trip_id}`}>
                        <Users aria-hidden />
                        {copy.flowOpenGroup}
                      </LocaleLink>
                    </Button>
                  ) : null}
                  <PlanWorkspace />
                </div>
              </details>
            </>
          ) : !pending && initialTripId ? (
            <Notice role="status">{copy.noSavedPlan}</Notice>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
