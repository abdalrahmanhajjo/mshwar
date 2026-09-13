"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";

export function PlanSplitCta() {
  const copy = useBrowseCopy();
  return (
    <section className="grid overflow-hidden rounded-card bg-brand text-brand-foreground lg:grid-cols-2">
      <div className="flex flex-col justify-center gap-5 p-8 md:p-12">
        <p className="text-xs uppercase tracking-[0.18em] text-brand-foreground/70">{copy.onePlanKicker}</p>
        <h2 className="max-w-md text-4xl font-semibold tracking-tight md:text-5xl">{copy.onePlanTitle}</h2>
        <p className="max-w-md text-sm text-brand-foreground/80">{copy.onePlanBody}</p>
        <Button asChild variant="secondary" className="w-fit rounded-pill bg-surface text-text">
          <Link href="/plan">{copy.buildTrip}</Link>
        </Button>
      </div>
      <div className="bg-surface-raised p-8 text-text md:p-12">
        <ol className="grid gap-6">
          {[copy.onePlanPoint1, copy.onePlanPoint2, copy.onePlanPoint3].map((point, index) => (
            <li key={point} className="flex items-start gap-3">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
              <span>
                <span className="sr-only">{index + 1}. </span>
                {point}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function SoftPlanCta() {
  const copy = useBrowseCopy();
  return (
    <section className="flex flex-col items-start justify-between gap-4 rounded-card bg-surface-sunken p-6 md:flex-row md:items-center md:p-8">
      <div>
        <h2 className="text-heading font-semibold tracking-tight">{copy.cantDecide}</h2>
        <p className="mt-1 text-sm text-text-muted">{copy.cantDecideBody}</p>
      </div>
      <Button asChild className="rounded-pill">
        <Link href="/plan">{copy.planMyTrip}</Link>
      </Button>
    </section>
  );
}
