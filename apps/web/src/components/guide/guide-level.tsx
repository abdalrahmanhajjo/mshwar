"use client";

import { Medal, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { interpolate } from "@/i18n/catalogues";
import type { GuideLevel } from "@/lib/guide-quality";
import { useGuideQualityCopy, type GuideQualityCopy } from "@/lib/guide-quality-copy";
import { cn } from "@/lib/utils";

/** "Trusted guide" or "Top guide". A new guide shows nothing: no badge is better than a hollow one. */
export function GuideLevelBadge({ level, className }: { level: GuideLevel | null | undefined; className?: string }) {
  const copy = useGuideQualityCopy();
  if (level !== "trusted" && level !== "top") return null;
  const Icon = level === "top" ? Medal : ShieldCheck;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-text", level === "top" ? "border-accent/60" : "border-brand/40", className)}
    >
      <Icon className={cn("size-3.5", level === "top" ? "text-accent" : "text-brand")} aria-hidden />
      {level === "top" ? copy.levelTop : copy.levelTrusted}
    </Badge>
  );
}

/** "45 min" or "3 h", for a typical reply time. */
export function replyTime(copy: GuideQualityCopy, minutes: number): string {
  return minutes < 90
    ? interpolate(copy.minutes, { n: String(Math.max(1, Math.round(minutes))) })
    : interpolate(copy.hours, { n: String(Math.round(minutes / 60)) });
}
