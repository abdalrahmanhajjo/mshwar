"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AuthStatus, type AuthState } from "@/components/shell/auth-status";
import { BrandMark } from "@/components/shell/brand-mark";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { MobileNav } from "@/components/shell/mobile-nav";
import { NavLink } from "@/components/shell/nav-link";
import { NAV_BY_SURFACE, type ShellSurface } from "@/components/shell/nav-config";
import { ShellFooter } from "@/components/shell/shell-footer";
import { useLocale } from "@/components/shell/locale-provider";

export interface AppShellProps {
  surface: ShellSurface;
  children: React.ReactNode;
  auth?: AuthState;
  currentPath?: string;
}

export function AppShell({ surface, children, auth, currentPath }: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const activePath = currentPath ?? pathname;
  const { t } = useLocale();
  const items = NAV_BY_SURFACE[surface];
  const homeHref = items[0]?.href ?? "/";
  const isSidebar = surface !== "traveller";

  return (
    <div
      data-shell={surface}
      className="flex min-h-dvh min-w-0 max-w-full flex-col overflow-x-clip bg-surface text-text"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-surface-raised focus:px-3 focus:py-2"
      >
        {t("skipToContent")}
      </a>

      {isSidebar ? (
        <div className="flex min-h-dvh min-w-0 flex-1">
          <aside className="hidden w-64 shrink-0 flex-col gap-6 border-e border-border bg-surface-raised p-4 lg:flex">
            <BrandMark href={homeHref} />
            <nav aria-label={t("menu")} className="flex flex-col gap-1">
              {items.map((item) => (
                <NavLink key={item.href} item={item} pathname={activePath} variant="stack" />
              ))}
            </nav>
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
              <div className="shell-gutter flex min-h-[3.5rem] items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <MobileNav items={items} pathname={activePath} auth={auth} />
                  <span className="truncate text-sm font-medium text-text lg:text-title">
                    {t(
                      surface === "admin"
                        ? "adminSurface"
                        : surface === "business"
                          ? "businessSurface"
                          : "travellerSurface",
                    )}
                  </span>
                </div>
                <div className="hidden items-center gap-3 lg:flex">
                  <LanguageSwitcher compact />
                  <AuthStatus auth={auth} />
                </div>
              </div>
            </header>
            <main id="main" className="shell-frame min-w-0 flex-1 py-6">
              {children}
            </main>
            <ShellFooter surface={surface} />
          </div>
        </div>
      ) : (
        <>
          <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
            <div className="shell-frame flex min-h-[3.5rem] items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <MobileNav items={items} pathname={activePath} auth={auth} />
                <BrandMark href={homeHref} compact />
              </div>
              <nav aria-label={t("menu")} className="hidden items-center gap-1 lg:flex">
                {items.map((item) => (
                  <NavLink key={item.href} item={item} pathname={activePath} />
                ))}
              </nav>
              <div className="hidden items-center gap-3 lg:flex">
                <LanguageSwitcher compact />
                <AuthStatus auth={auth} />
              </div>
            </div>
          </header>
          <main id="main" className="shell-frame min-w-0 flex-1 py-6">
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

export function BusinessShell(props: Omit<AppShellProps, "surface">) {
  return <AppShell surface="business" {...props} />;
}

export function AdminShell(props: Omit<AppShellProps, "surface">) {
  return <AppShell surface="admin" {...props} />;
}

export function ShellMain({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex min-w-0 max-w-full flex-col gap-4", className)} {...props} />;
}
