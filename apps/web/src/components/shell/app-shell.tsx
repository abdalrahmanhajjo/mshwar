"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Bell } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { VerificationBanner } from "@/components/auth/verification-banner";
import { PolicyUpdateBanner } from "@/components/legal/policy-update-banner";
import { useAuth } from "@/components/shell/auth-provider";
import { AuthStatus, type AuthState } from "@/components/shell/auth-status";
import { BrandMark } from "@/components/shell/brand-mark";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { LocaleLink } from "@/components/shell/locale-link";
import { MobileNav } from "@/components/shell/mobile-nav";
import { NavLink } from "@/components/shell/nav-link";
import { NAV_BY_SURFACE, isNavActive, type ShellNavItem, type ShellSurface } from "@/components/shell/nav-config";
import type { MessageKey } from "@/lib/messages";
import { ShellFooter } from "@/components/shell/shell-footer";
import { useLocale } from "@/components/shell/locale-provider";
import { localeDirection } from "@/lib/locale";

export interface AppShellProps {
  surface: ShellSurface;
  children: React.ReactNode;
  auth?: AuthState;
  currentPath?: string;
  /** Navigation for a surface outside the registry (the legacy business portal). */
  items?: ShellNavItem[];
  surfaceLabel?: MessageKey;
}

const SURFACE_LABEL = {
  traveller: "travellerSurface",
  guide: "guideSurface",
  admin: "adminSurface",
  partner: "partnerSurface",
} as const;

export function AppShell({ surface, children, auth, currentPath, items: itemsOverride, surfaceLabel }: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const activePath = currentPath ?? pathname;
  const { t, locale } = useLocale();
  const ctx = useAuth();
  const resolvedAuth = auth ?? ctx.auth;
  const items = itemsOverride ?? NAV_BY_SURFACE[surface];
  const label = surfaceLabel ?? SURFACE_LABEL[surface];
  const homeHref = items[0]?.href ?? "/";
  const isSidebar = surface !== "traveller";
  const activeItem = items.find((item) => isNavActive(activePath, item));

  return (
    <div
      data-shell={surface}
      lang={locale}
      dir={localeDirection(locale)}
      className="flex min-h-dvh min-w-0 max-w-full flex-col bg-surface text-text"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[90] focus:rounded-control focus:bg-surface-raised focus:px-3 focus:py-2 focus:shadow-md"
      >
        {t("skipToContent")}
      </a>

      {isSidebar ? (
        <div className="flex min-h-dvh min-w-0 flex-1">
          <div className="hidden w-[17rem] shrink-0 border-e border-border-subtle bg-surface-raised/60 lg:block print:hidden">
            <aside className="sticky top-0 flex h-dvh flex-col gap-8 px-4 py-5">
              <div className="flex items-center justify-between gap-2 px-1">
                <BrandMark href={homeHref} compact />
                <span className="rounded-pill bg-brand-subtle px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-text">
                  {t(label)}
                </span>
              </div>
              <nav aria-label={t("menu")} className="-mx-1 flex flex-col gap-0.5 overflow-y-auto">
                {items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={activePath} variant="stack" />
                ))}
              </nav>
              <div className="mt-auto grid gap-3">
                <p className="px-1 text-xs leading-relaxed text-text-muted">
                  {t(surface === "admin" ? "adminFooter" : surface === "partner" ? "partnerFooter" : "guideFooter")}
                </p>
                <AuthStatus auth={resolvedAuth} variant="panel" />
              </div>
            </aside>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/85 backdrop-blur-md print:hidden">
              <div className="shell-gutter flex min-h-16 items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <MobileNav items={items} pathname={activePath} auth={auth} />
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="hidden text-text-muted sm:inline">{t(label)}</span>
                    <span className="hidden text-border sm:inline" aria-hidden>
                      /
                    </span>
                    <span className="truncate font-semibold text-text">
                      {activeItem ? t(activeItem.labelKey) : t(label)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <LanguageSwitcher compact />
                </div>
              </div>
            </header>
            <PolicyUpdateBanner />
            <main id="main" className="min-w-0 flex-1">
              {children}
            </main>
            <ShellFooter surface={surface} />
          </div>
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface/85 backdrop-blur-md print:hidden">
            <div className="shell-frame grid min-h-16 grid-cols-[1fr_auto] items-center gap-3 py-2 lg:min-h-[4.5rem] lg:grid-cols-[1fr_auto_1fr]">
              <div className="flex min-w-0 items-center gap-2">
                <MobileNav items={items} pathname={activePath} auth={auth} />
                <BrandMark href={homeHref} compact />
              </div>
              <nav aria-label={t("menu")} className="hidden items-center gap-1 lg:flex">
                {items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={activePath} />
                ))}
              </nav>
              <div className="flex items-center justify-end gap-1.5 sm:gap-3">
                <LocaleLink
                  href="/guide"
                  className={cn(
                    "hidden items-center gap-1 rounded-control px-2 py-2 text-sm text-text hover:text-text/70 xl:inline-flex",
                    focusRing,
                  )}
                >
                  {t("forGuides")}
                  <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                </LocaleLink>
                <LanguageSwitcher compact />
                {resolvedAuth.status === "signed-in" ? (
                  <LocaleLink
                    href="/notifications"
                    aria-label={t("notifications")}
                    className={cn(
                      "hidden size-10 items-center justify-center rounded-full text-text transition-colors hover:bg-surface-sunken lg:inline-flex",
                      focusRing,
                    )}
                  >
                    <Bell className="size-[1.15rem]" strokeWidth={1.75} aria-hidden />
                  </LocaleLink>
                ) : null}
                <div className="hidden lg:block">
                  <AuthStatus auth={auth} />
                </div>
              </div>
            </div>
          </header>
          <PolicyUpdateBanner />
          {surface === "traveller" ? <VerificationBanner /> : null}
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
          <ShellFooter surface={surface} />
        </>
      )}
    </div>
  );
}

export function TravellerShell(props: Omit<AppShellProps, "surface">) {
  return <AppShell surface="traveller" {...props} />;
}

export function GuideShell(props: Omit<AppShellProps, "surface">) {
  return <AppShell surface="guide" {...props} />;
}

export function AdminShell(props: Omit<AppShellProps, "surface">) {
  return <AppShell surface="admin" {...props} />;
}

export function PartnerShell(props: Omit<AppShellProps, "surface">) {
  return <AppShell surface="partner" {...props} />;
}

export function ShellMain({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("shell-frame flex min-w-0 max-w-full flex-col gap-10 pb-20 pt-10 md:pt-14", className)}
      {...props}
    />
  );
}
