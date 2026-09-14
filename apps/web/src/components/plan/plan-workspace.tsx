"use client";

import * as React from "react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StartLocationPicker } from "@/components/plan/start-location-picker";
import { WeatherWarningList } from "@/components/plan/weather-warning";
import { ReplanDiff } from "@/components/plan/replan-diff";
import { usePlannerCopy } from "@/lib/planner-copy";
import {
  evaluatePlanWarnings,
  optimizePlan,
  replanPlan,
  samplePlan,
  type OptimizeResult,
  type ReplanResult,
  type StartLocation,
  type WarningResult,
} from "@/lib/planner";
import { fetchProfile } from "@/lib/profile";
import { LEBANON } from "@/lib/portal";

const FALLBACK_START: StartLocation = {
  lat: LEBANON.beirut.lat,
  lng: LEBANON.beirut.lng,
  label: "Beirut",
  source: "manual",
};

export function PlanWorkspace() {
  const copy = usePlannerCopy();
  const [start, setStart] = React.useState<StartLocation>(FALLBACK_START);
  const [optimized, setOptimized] = React.useState<OptimizeResult | null>(null);
  const [warnings, setWarnings] = React.useState<WarningResult | null>(null);
  const [replan, setReplan] = React.useState<ReplanResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchProfile()
      .then((profile) => {
        const saved = profile.preferences.start_location as StartLocation | null | undefined;
        if (saved?.label) {
          setStart(saved);
        }
      })
      .catch(() => undefined);
  }, []);

  const plan = samplePlan(start);

  async function onOptimize() {
    setError(null);
    try {
      const result = await optimizePlan(plan);
      setOptimized(result);
      const nextWarnings = await evaluatePlanWarnings(plan.stops);
      setWarnings(nextWarnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.infeasible);
    }
  }

  async function onReplan() {
    setError(null);
    try {
      const result = await replanPlan(plan, ["hike"]);
      setReplan(result);
      if (!result.applied) {
        setError(result.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.replanNone);
    }
  }

  return (
    <div className="grid gap-6">
      <StartLocationPicker initial={start} onSaved={setStart} />
      <p className="text-sm">
        <LocaleLink className="text-brand underline-offset-4 hover:underline" href="/plan/start">
          {copy.startTitle}
        </LocaleLink>
      </p>
      <Card>
        <CardHeader>
          <CardTitle>{copy.planTitle}</CardTitle>
          <CardDescription>{copy.planHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm">
            {start.label} ({start.lat.toFixed(4)}, {start.lng.toFixed(4)})
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void onOptimize()}>
              {copy.optimize}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void onReplan()}>
              {copy.replanAffected}
            </Button>
          </div>
          {optimized && !optimized.feasible ? <p className="text-sm text-danger">{copy.infeasible}</p> : null}
          {optimized && !optimized.metrics_available ? (
            <p role="status" className="text-sm text-danger">
              {copy.metricsUnavailable}
            </p>
          ) : null}
          {optimized?.ordered_stops.length ? (
            <ol className="grid gap-1 text-sm">
              {optimized.ordered_stops.map((stop) => (
                <li key={stop.id}>
                  {stop.position}. {stop.label}
                  {stop.locked ? " (locked)" : ""}
                </li>
              ))}
            </ol>
          ) : null}
          <WeatherWarningList result={warnings} />
          <ReplanDiff result={replan} />
          {error ? (
            <p role="status" className="text-sm">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
