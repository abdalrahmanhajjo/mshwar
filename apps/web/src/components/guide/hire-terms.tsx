"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { useGuide } from "@/components/guide/guide-provider";
import { ApiError } from "@/lib/api/client";
import { useGuideHireCopy } from "@/lib/guide-hire-copy";
import { setHireTerms, type HireableGuide } from "@/lib/guide-hire";

/** Day rate and largest group, for being hired from the planner. A host sees why not. */
export function HireTerms() {
  const copy = useGuideHireCopy();
  const { profile, reload } = useGuide();
  const hire = profile as (typeof profile & Partial<HireableGuide>) | null;
  const [rate, setRate] = React.useState(
    hire?.day_rate_minor !== null && hire?.day_rate_minor !== undefined ? String(hire.day_rate_minor / 100) : "",
  );
  const [group, setGroup] = React.useState(String(hire?.max_group ?? 12));
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!hire) {
    return null;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await setHireTerms({
        day_rate_minor: rate === "" ? null : Math.round(Number(rate) * 100),
        max_group: Number(group),
      });
      setSaved(true);
      reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.hireLoadError);
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="hire-terms"
      className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
    >
      <h2 id="hire-terms" className="title-section text-[1.15rem]">
        {copy.termsTitle}
      </h2>
      {hire.tier === "host" ? (
        <Notice tone="info">{copy.termsHost}</Notice>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} className="grid gap-3">
          <p className="text-sm text-text-muted">{copy.termsBody}</p>
          {hire.hireable ? (
            <Notice tone="success">{copy.termsLive}</Notice>
          ) : hire.day_rate_minor !== null && hire.day_rate_minor !== undefined ? (
            <Notice tone="warning">{copy.termsLapsed}</Notice>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-[12rem_12rem_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="day-rate">{copy.termsRate}</Label>
              <Input id="day-rate" type="number" min={0} value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="max-group">{copy.termsGroup}</Label>
              <Input
                id="max-group"
                type="number"
                min={1}
                max={60}
                value={group}
                onChange={(e) => setGroup(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {copy.termsSave}
            </Button>
          </div>
          {saved ? (
            <p role="status" className="text-sm text-success">
              {copy.termsSaved}
            </p>
          ) : null}
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
        </form>
      )}
    </section>
  );
}
