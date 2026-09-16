"use client";

import { CheckCircle2 } from "lucide-react";
import { useCheckoutCopy } from "@/lib/checkout-copy";

export function ConfirmationView({ title, body, dir }: { title: string; body: string; dir: string }) {
  const copy = useCheckoutCopy();
  return (
    <article
      className="relative grid gap-4 overflow-hidden rounded-card bg-brand p-7 text-brand-foreground md:p-9"
      dir={dir}
      aria-label={copy.confirmation}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-accent/15 blur-2xl"
      />
      <span className="grid size-12 place-items-center rounded-full bg-brand-foreground/10">
        <CheckCircle2 className="size-6 text-accent" aria-hidden />
      </span>
      <h1 className="title-page text-[2.2rem]">{copy.confirmation}</h1>
      <p className="text-lg font-medium">{title}</p>
      <pre className="whitespace-pre-wrap rounded-control bg-brand-foreground/10 p-4 font-sans text-sm leading-relaxed text-brand-foreground/90">
        {body}
      </pre>
    </article>
  );
}
