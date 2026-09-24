"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { LogIn } from "lucide-react";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency, formatDate } from "@/i18n/format";
import type { Locale } from "@/lib/locale";
import { useLocalCopy } from "@/lib/local-copy";
import { cn, focusRing } from "@/lib/utils";
import { useNow } from "@/lib/use-now";

/** Money in whole units from minor units; every currency Mshwar uses has two minor digits. */
export function money(locale: Locale, minor: number, currency = "USD"): string {
  const amount = minor / 100;
  return formatCurrency(locale, amount, currency, {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  });
}

/** A plain calendar day ("2026-09-18") shown in the reader's language. */
export function useDay(): (value: string) => string {
  const { locale } = useLocale();
  return React.useCallback(
    (value: string) => formatDate(locale, `${value.slice(0, 10)}T12:00:00Z`, { dateStyle: "medium" }),
    [locale],
  );
}

export function useSignedIn(): boolean {
  return useAuth().auth.status === "signed-in";
}

/** Sends a guest to sign in and straight back to this page. */
export function SignInLink({ label, className }: { label?: string; className?: string }) {
  const copy = useLocalCopy();
  const pathname = usePathname() ?? "/";
  return (
    <LocaleLink
      href={`/signin?next=${encodeURIComponent(pathname)}`}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline",
        focusRing,
        className,
      )}
    >
      <LogIn className="size-4 rtl:-scale-x-100" aria-hidden />
      {label ?? copy.signInToReport}
    </LocaleLink>
  );
}

/** A dated "checked on" line with a warning once the re-check date has passed. */
export function CheckedLine({ checkedOn, reviewBy }: { checkedOn: string | null; reviewBy?: string | null }) {
  const copy = useLocalCopy();
  const day = useDay();
  const now = useNow();
  if (!checkedOn) {
    return null;
  }
  const due = reviewBy ? new Date(`${reviewBy.slice(0, 10)}T23:59:59Z`).getTime() < now : false;
  return (
    <p className="text-xs text-text-muted">
      {interpolate(copy.checkedOn, { date: day(checkedOn) })}
      {due ? <span className="ms-2 font-medium text-warning">{copy.reviewDue}</span> : null}
    </p>
  );
}
