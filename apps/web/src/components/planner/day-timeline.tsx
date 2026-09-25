"use client";

import * as React from "react";
import {
  Banknote,
  BedDouble,
  CircleSlash,
  Landmark,
  Lock,
  LockOpen,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { lineAmount } from "@/components/planner/day-cost";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { interpolate } from "@/i18n/catalogues";
import {
  byDay,
  chooseStepOption,
  fetchStepOptions,
  lockPlannerStop,
  type DayStepOutcome,
  type PlanDocument,
  type PlannerSession,
  type StepOption,
} from "@/lib/planner";
import type { PlannerCopy, PlannerKey } from "@/lib/planner-copy";

const ROLE_ICON: Record<DayStepOutcome["role"], LucideIcon> = {
  meal: Utensils,
  sight: Landmark,
  activity: Sparkles,
  stay: BedDouble,
  service: MapPin,
  exchange: Banknote,
};

/** Flags worth a traveller's attention; the price flags are already said by the price itself. */
export const SHOWN_FLAGS = new Set([
  "check_times",
  "outside_destination",
  "long_wait",
  "hours_unknown",
  "meal_unconfirmed",
  "needs_unconfirmed",
]);

const whatsapp = (number: string) => `https://wa.me/${number.replace(/[^\d]/g, "")}`;

function clock(value: string | null, locale: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Beirut" }).format(
    new Date(value),
  );
}

function trustLabel(step: DayStepOutcome, copy: PlannerCopy): string | null {
  if (step.status === "office") return copy.trust_changer; // only registered, verified changers are offered
  const level = step.trust?.level;
  return level ? (copy[`trust_${level}` as PlannerKey] ?? null) : null;
}

function StepActions({ step, copy }: { step: DayStepOutcome; copy: PlannerCopy }) {
  const actions = step.actions ?? {};
  const phone = actions.reservation_phone ?? step.office?.phone;
  const links: { href: string; label: string; icon: LucideIcon; external?: boolean }[] = [];
  if (phone) links.push({ href: `tel:${phone.replace(/\s/g, "")}`, label: copy.action_call, icon: Phone });
  if (actions.reservation_whatsapp) {
    links.push({
      href: whatsapp(actions.reservation_whatsapp),
      label: copy.action_whatsapp,
      icon: MessageCircle,
      external: true,
    });
  }
  if (actions.reservation_url) {
    links.push({ href: actions.reservation_url, label: copy.action_reserve, icon: Utensils, external: true });
  }
  if (actions.booking_url)
    links.push({ href: actions.booking_url, label: copy.action_book, icon: BedDouble, external: true });
  if (!links.length && !actions.check_in) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map(({ href, label, icon: Icon, external }) => (
        <a
          key={label}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1 text-sm hover:bg-surface-raised"
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </a>
      ))}
      {actions.check_in ? (
        <span className="text-sm text-text-muted">
          {interpolate(copy.checkInFrom, { time: actions.check_in.slice(0, 5) })}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Other trusted places for one step, near the step before it, each with its published price. Choosing
 * one re-plans the day around it; every other step keeps its place.
 */
function StepOptions({
  step,
  sessionId,
  copy,
  onChoose,
}: {
  step: DayStepOutcome;
  sessionId: string;
  copy: PlannerCopy;
  onChoose: (task: () => Promise<PlannerSession>) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [options, setOptions] = React.useState<StepOption[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const day = step.day ?? 1;
  const listId = `step-options-${day}-${step.order}`;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && options === null) {
      setFailed(false);
      fetchStepOptions(sessionId, step.order, day)
        .then((found) => setOptions(found.filter((option) => option.experience_id !== step.experience_id)))
        .catch(() => setFailed(true));
    }
  };

  return (
    <div className="grid gap-2">
      <Button type="button" size="sm" variant="ghost" aria-expanded={open} aria-controls={listId} onClick={toggle}>
        <Shuffle aria-hidden />
        {open ? copy.hideOptions : copy.otherOptions}
      </Button>
      {open ? (
        <div id={listId} className="grid gap-2">
          {failed ? (
            <p className="text-sm text-danger">{copy.optionsFailed}</p>
          ) : options === null ? (
            <p className="text-sm text-text-muted">{copy.optionsLoading}</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-text-muted">{copy.noOptions}</p>
          ) : (
            <ul className="grid gap-2">
              {options.map((option) => {
                const trust = option.trust?.level ? copy[`trust_${option.trust.level}` as PlannerKey] : null;
                return (
                  <li
                    key={option.experience_id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-sunken px-3 py-2"
                  >
                    <div className="grid gap-0.5">
                      <span className="font-medium">{option.title}</span>
                      <span className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                        {trust ? <span>{trust}</span> : null}
                        {option.distance_m != null ? (
                          <span>{interpolate(copy.optionDistance, { km: (option.distance_m / 1000).toFixed(1) })}</span>
                        ) : null}
                        <span className="tabular-nums">{lineAmount(option.price, copy)}</span>
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void onChoose(() => chooseStepOption(sessionId, step.order, day, option.experience_id))
                      }
                    >
                      {copy.useOption}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A day told step by step: every step the traveller asked for, in their order - filled by a trusted
 * place, served by a registered money changer, skipped because it was optional, or left empty with the
 * reason. Nothing they asked for silently disappears.
 */
export function DayTimeline({
  steps,
  plan,
  copy,
  sessionId,
  onLock,
}: {
  steps: DayStepOutcome[];
  plan: PlanDocument;
  copy: PlannerCopy;
  sessionId?: string;
  onLock?: (task: () => Promise<PlannerSession>) => Promise<void>;
}) {
  const { locale } = useLocale();
  const days = byDay(steps);
  const stopFor = (step: DayStepOutcome) => plan.stops.find((stop) => stop.experience_id === step.experience_id);

  return (
    <section aria-labelledby="day-timeline-heading" className="grid gap-4">
      <div className="grid gap-1">
        <h3 id="day-timeline-heading" className="title-card">
          {copy.dayTitle}
        </h3>
        <p className="text-sm text-text-muted">{copy.dayBody}</p>
      </div>
      {days.map(([day, daySteps]) => (
        <div key={day} className="grid gap-3">
          {days.length > 1 ? <h4 className="font-semibold">{interpolate(copy.tripDay, { day })}</h4> : null}
          <ol className="grid gap-3" aria-label={interpolate(copy.tripDay, { day })}>
            {daySteps.map((step) => {
              const Icon = ROLE_ICON[step.role] ?? MapPin;
              const gap = step.status === "empty" || step.status === "skipped";
              const name =
                step.title ?? step.office?.branch_name ?? step.named_place ?? copy[`role_${step.role}` as PlannerKey];
              const trust = gap ? null : trustLabel(step, copy);
              const stop = step.status === "filled" ? stopFor(step) : undefined;
              const flags = step.flags.filter((flag) => SHOWN_FLAGS.has(flag));
              return (
                <li
                  key={`${day}-${step.order}`}
                  className={
                    gap
                      ? "grid gap-2 rounded-card border border-dashed border-border-subtle p-4"
                      : "grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-4 shadow-sm"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-brand-subtle" aria-hidden>
                        {gap ? <CircleSlash className="size-4" /> : <Icon className="size-4" />}
                      </span>
                      <div className="grid gap-0.5">
                        <p className="text-sm text-text-muted">
                          {step.order}. {copy[`role_${step.role}` as PlannerKey]}
                          {step.starts_at ? ` · ${clock(step.starts_at, locale)}` : ""}
                          {step.ends_at && step.ends_at !== step.starts_at ? ` – ${clock(step.ends_at, locale)}` : ""}
                        </p>
                        <h4 className="font-medium">
                          {gap ? (step.status === "skipped" ? copy.status_skipped : copy.status_empty) : name}
                        </h4>
                      </div>
                    </div>
                    {!gap && step.price ? (
                      <span className="text-sm font-medium tabular-nums">{lineAmount(step.price, copy)}</span>
                    ) : null}
                  </div>

                  {gap ? (
                    <div className="grid gap-1 text-sm text-text-muted">
                      {step.reason ? <p>{copy[`reason_${step.reason}` as PlannerKey] ?? step.reason}</p> : null}
                      {step.text ? <p>{interpolate(copy.askedFor, { text: step.text })}</p> : null}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
                        {trust ? (
                          <Badge variant="success" className="inline-flex items-center gap-1">
                            <ShieldCheck className="size-3" aria-hidden />
                            {trust}
                          </Badge>
                        ) : null}
                        {flags.map((flag) => (
                          <Badge key={flag} variant="warning">
                            {copy[`flag_${flag}` as PlannerKey]}
                          </Badge>
                        ))}
                        {step.travel_minutes ? (
                          <span>{interpolate(copy.driveMinutes, { minutes: step.travel_minutes })}</span>
                        ) : null}
                        {step.wait_minutes >= 45 ? (
                          <span>{interpolate(copy.freeMinutes, { minutes: step.wait_minutes })}</span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <StepActions step={step} copy={copy} />
                        {stop && sessionId && onLock ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            aria-pressed={stop.locked}
                            onClick={() => void onLock(() => lockPlannerStop(sessionId, stop.id, !stop.locked))}
                          >
                            {stop.locked ? <Lock aria-hidden /> : <LockOpen aria-hidden />}
                            {stop.locked ? copy.unlock : copy.lock}
                          </Button>
                        ) : null}
                      </div>
                      {step.status === "filled" && sessionId && onLock ? (
                        <StepOptions step={step} sessionId={sessionId} copy={copy} onChoose={onLock} />
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
