"use client";

import * as React from "react";
import { BadgeCheck, CalendarCheck, CircleAlert, ShieldCheck, Video } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import type { PartnerTrust, TrustCheck, TrustLevel } from "@/lib/partners";
import { cn } from "@/lib/utils";
import { useVerifiedCopy, type VerifiedCopy, type VerifiedKey } from "@/lib/verified-copy";

export function trustLevelLabel(level: TrustLevel, copy: VerifiedCopy): string {
  return copy[`level_${level}` as VerifiedKey];
}

export function TrustBadge({ level, className }: { level: TrustLevel; className?: string }) {
  const copy = useVerifiedCopy();
  const variant = level === "verified" ? "success" : level === "lapsed" ? "warning" : "outline";
  return (
    <Badge variant={variant} className={cn("gap-1", className)}>
      {level === "verified" ? <BadgeCheck className="size-3.5" aria-hidden /> : null}
      {level === "lapsed" ? <CircleAlert className="size-3.5" aria-hidden /> : null}
      {trustLevelLabel(level, copy)}
    </Badge>
  );
}

function checkLabel(check: TrustCheck, copy: VerifiedCopy): string {
  const key = `check_${check.kind}` as VerifiedKey;
  const label = copy[key] ?? check.kind;
  return check.vehicle_plate ? `${label} (${interpolate(copy.forPlate, { plate: check.vehicle_plate })})` : label;
}

/**
 * "What we checked": one line per verified document with when it was checked and
 * until when, plus the last time a person met them. Never a bare tick.
 */
export function WhatWeChecked({
  trust,
  className,
  compact = false,
}: {
  trust: PartnerTrust;
  className?: string;
  compact?: boolean;
}) {
  const copy = useVerifiedCopy();
  const { locale } = useLocale();
  const headingId = React.useId();
  const day = (value: string) => formatDate(locale, `${value}T12:00:00Z`, { dateStyle: "medium" });
  const inPerson = trust.in_person
    ? interpolate(
        trust.in_person.kind === "visit"
          ? copy.metInPerson
          : trust.in_person.kind === "recheck"
            ? copy.recheckedOn
            : copy.metOnCall,
        { date: day(trust.in_person.on) },
      )
    : null;

  return (
    <section
      aria-labelledby={headingId}
      className={cn("grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-4 text-success" aria-hidden />
          {copy.whatWeChecked}
        </h2>
        <TrustBadge level={trust.level} />
      </div>
      {compact ? null : <p className="text-sm text-text-muted">{copy.whatWeCheckedBody}</p>}
      {trust.checks.length ? (
        <ul className="grid gap-2 text-sm">
          {trust.checks.map((check) => (
            <li
              key={`${check.kind}-${check.vehicle_plate ?? ""}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
            >
              <CalendarCheck className="size-3.5 translate-y-0.5 shrink-0 text-success" aria-hidden />
              <span className="font-medium">{checkLabel(check, copy)}</span>
              <span className="text-text-muted">
                {check.checked_on ? interpolate(copy.checkedOn, { date: day(check.checked_on) }) : null}
                {check.valid_until ? ` · ${interpolate(copy.validUntil, { date: day(check.valid_until) })}` : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{copy.noChecks}</p>
      )}
      {inPerson ? (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <Video className="size-3.5 shrink-0" aria-hidden />
          {inPerson}
        </p>
      ) : null}
    </section>
  );
}
