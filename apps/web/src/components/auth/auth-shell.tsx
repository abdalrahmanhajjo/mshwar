"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/components/shell/auth-provider";
import { BrandMark } from "@/components/shell/brand-mark";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { useAuthCopy } from "@/lib/auth-copy";
import { localeDirection, withLocalePrefix } from "@/lib/locale";
import { cn, focusRing } from "@/lib/utils";

const link = cn(
  "rounded-sm font-semibold text-text underline decoration-border underline-offset-4 hover:decoration-text",
  focusRing,
);

/** The one thing worth offering in the header of each auth screen. */
function HeaderAction() {
  const copy = useAuthCopy();
  const { t, locale } = useLocale();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const path = (usePathname() ?? "/").replace(/^\/(en|ar|fr)(?=\/|$)/, "") || "/";

  if (path.startsWith("/signup")) {
    return (
      <p className="text-sm text-text-muted">
        <span className="hidden sm:inline">{copy.haveAccount} </span>
        <LocaleLink href="/signin" className={link}>
          {copy.signInLink}
        </LocaleLink>
      </p>
    );
  }
  if (path.startsWith("/signin")) {
    return (
      <p className="text-sm text-text-muted">
        <span className="hidden sm:inline">{copy.newHere} </span>
        <LocaleLink href="/signup" className={link}>
          {copy.createLink}
        </LocaleLink>
      </p>
    );
  }
  if (path.startsWith("/verify-email") && user) {
    return (
      <button
        type="button"
        className={cn(link, "text-sm")}
        onClick={() => void signOut().then(() => router.replace(withLocalePrefix(locale, "/signin")))}
      >
        {t("signOut")}
      </button>
    );
  }
  return (
    <LocaleLink href="/signin" className={cn(link, "inline-flex items-center gap-1.5 text-sm no-underline")}>
      <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
      {copy.backToSignIn}
    </LocaleLink>
  );
}

/**
 * The frame around sign-up, sign-in, verification and recovery: the logo, one
 * relevant way out, the language, and nothing that pulls attention off the task.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useLocale();
  const copy = useAuthCopy();
  return (
    <div
      data-shell="auth"
      lang={locale}
      dir={localeDirection(locale)}
      className="flex min-h-dvh min-w-0 flex-col bg-surface text-text"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[90] focus:rounded-control focus:bg-surface-raised focus:px-3 focus:py-2 focus:shadow-md"
      >
        {t("skipToContent")}
      </a>
      <header className="print:hidden">
        <div className="shell-frame flex min-h-16 items-center justify-between gap-4 py-3 lg:min-h-[4.5rem]">
          <BrandMark href="/" compact />
          <div className="flex items-center gap-4 sm:gap-5">
            <HeaderAction />
          </div>
        </div>
      </header>
      <main id="main" className="shell-frame flex min-w-0 flex-1 flex-col justify-center pb-10 pt-4 sm:pt-6 lg:pb-14">
        {children}
      </main>
      <footer className="print:hidden">
        <div className="shell-frame flex flex-col gap-4 border-t border-border-subtle py-5 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Mshwar</p>
          <nav aria-label={t("contact")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <LocaleLink href="/privacy" className={cn("hover:text-text", focusRing)}>
              {t("privacy")}
            </LocaleLink>
            <LocaleLink href="/terms" className={cn("hover:text-text", focusRing)}>
              {t("terms")}
            </LocaleLink>
            <LocaleLink href="/contact" className={cn("hover:text-text", focusRing)}>
              {copy.help}
            </LocaleLink>
            <LanguageSwitcher compact />
          </nav>
        </div>
      </footer>
    </div>
  );
}
