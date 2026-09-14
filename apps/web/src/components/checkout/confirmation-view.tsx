"use client";

import { useCheckoutCopy } from "@/lib/checkout-copy";

export function ConfirmationView({
  title,
  body,
  dir,
}: {
  title: string;
  body: string;
  dir: string;
}) {
  const copy = useCheckoutCopy();
  return (
    <article className="grid gap-3 rounded-card border border-border p-4" dir={dir} aria-label={copy.confirmation}>
      <h1 className="text-2xl font-semibold">{copy.confirmation}</h1>
      <p className="font-medium">{title}</p>
      <pre className="whitespace-pre-wrap text-sm text-text">{body}</pre>
    </article>
  );
}
