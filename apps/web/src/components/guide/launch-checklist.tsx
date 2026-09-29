"use client";

import * as React from "react";
import { Award, Check, Circle, Copy, Share2 } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { interpolate } from "@/i18n/catalogues";
import { useGuideJoinCopy } from "@/lib/guide-join-copy";
import { launchSteps } from "@/lib/guide-launch";
import { fetchAvailability, fetchMyTours, type GuideAvailability, type GuideTour } from "@/lib/guide-work";
import type { MyGuideProfile } from "@/lib/guides";
import { withLocalePrefix } from "@/lib/locale";
import { cn, focusRing } from "@/lib/utils";

/** "You're Founding Guide #n", shown to the guide the database numbered. */
export function FoundingBanner({ number }: { number: number | null | undefined }) {
  const copy = useGuideJoinCopy();
  if (!number) return null;
  return (
    <div className="flex items-start gap-4 rounded-card border border-accent/30 bg-accent/5 p-5">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
        <Award className="size-5" aria-hidden />
      </span>
      <div className="grid gap-1">
        <p className="font-semibold">{interpolate(copy.homeFoundingTitle, { n: String(number) })}</p>
        <p className="text-sm text-text-muted">{copy.homeFoundingBody}</p>
      </div>
    </div>
  );
}

function ShareLink({ slug }: { slug: string }) {
  const copy = useGuideJoinCopy();
  const { locale } = useLocale();
  const [copied, setCopied] = React.useState(false);
  const path = withLocalePrefix(locale, `/guides/${slug}`);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
      <span className="inline-flex items-center gap-2 text-sm font-medium">
        <Share2 className="size-4 text-brand" aria-hidden />
        {copy.launchShare}
      </span>
      <code className="truncate rounded-control bg-surface-sunken px-2.5 py-1 text-xs">{path}</code>
      <Button type="button" size="sm" variant="outline" onClick={() => void onCopy()}>
        <Copy aria-hidden />
        {copied ? copy.launchCopied : copy.launchCopy}
      </Button>
    </div>
  );
}

/**
 * What an approved guide still has to do before travellers can book them, ticked from
 * their real profile, tours and weekly times. It stays until every step is done.
 */
export function LaunchChecklist({ profile }: { profile: MyGuideProfile }) {
  const copy = useGuideJoinCopy();
  const [data, setData] = React.useState<{ tours: GuideTour[]; availability: GuideAvailability | null } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchMyTours(), fetchAvailability().catch(() => null)])
      .then(([tours, availability]) => {
        if (!cancelled) setData({ tours, availability });
      })
      .catch(() => {
        if (!cancelled) setData({ tours: [], availability: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;
  const steps = launchSteps(profile, data.tours, data.availability);
  const done = steps.filter((step) => step.done).length;
  const complete = done === steps.length;

  return (
    <section
      aria-labelledby="launch-title"
      className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm md:p-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="launch-title" className="title-section text-[1.15rem]">
          {copy.launchTitle}
        </h2>
        <span className="text-sm font-medium tabular-nums text-text-muted">
          {interpolate(copy.launchProgress, { done: String(done), total: String(steps.length) })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-surface-sunken" aria-hidden>
        <div
          className="h-full rounded-pill bg-brand transition-[width]"
          style={{ width: `${(done / steps.length) * 100}%` }}
        />
      </div>
      {complete ? (
        <p className="text-sm font-medium text-success">{copy.launchDone}</p>
      ) : (
        <ol className="grid gap-1.5">
          {steps.map((step) => (
            <li key={step.key} className="flex items-center justify-between gap-3 rounded-control px-1 py-1.5">
              <span
                className={cn("inline-flex items-center gap-2.5 text-sm", step.done && "text-text-muted line-through")}
              >
                {step.done ? (
                  <Check className="size-4 shrink-0 text-success" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-text-muted" aria-hidden />
                )}
                {copy[step.key]}
              </span>
              {step.done ? null : step.href.startsWith("#") ? (
                <a
                  href={step.href}
                  className={cn("text-sm font-semibold text-brand underline-offset-4 hover:underline", focusRing)}
                >
                  {copy.launchGo}
                </a>
              ) : (
                <LocaleLink
                  href={step.href}
                  className={cn("text-sm font-semibold text-brand underline-offset-4 hover:underline", focusRing)}
                >
                  {copy.launchGo}
                </LocaleLink>
              )}
            </li>
          ))}
        </ol>
      )}
      <ShareLink slug={profile.slug} />
    </section>
  );
}
