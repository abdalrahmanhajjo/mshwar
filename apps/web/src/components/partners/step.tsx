"use client";

import * as React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { interpolate } from "@/i18n/catalogues";
import { usePartnerCopy } from "@/lib/partner-copy";
import { cn } from "@/lib/utils";

/** One numbered step of a partner application, marked done when its part is complete. */
export function Step({
  n,
  title,
  done,
  id,
  children,
  className,
}: {
  n: number;
  title: string;
  done: boolean;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const copy = usePartnerCopy();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6", className)}
    >
      <div className="flex items-start gap-3">
        {done ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
        ) : (
          <Circle className="mt-0.5 size-5 shrink-0 text-text-muted" aria-hidden />
        )}
        <div className="grid gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
            {interpolate(copy.step, { n: String(n) })}
          </span>
          <h2 id={`${id}-title`} className="title-section text-[1.2rem]">
            {title}
          </h2>
        </div>
      </div>
      {children}
    </section>
  );
}

/** Error text from the API, or a generic line. */
export function errorText(caught: unknown, fallback: string): string {
  if (caught && typeof caught === "object" && "message" in caught && typeof caught.message === "string") {
    const status = (caught as { status?: number }).status;
    if (status && status < 500) {
      return caught.message;
    }
  }
  return fallback;
}
