"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { AuthStatus, type AuthState } from "@/components/shell/auth-status";
import { NavLink } from "@/components/shell/nav-link";
import { useLocale } from "@/components/shell/locale-provider";
import type { ShellNavItem } from "@/components/shell/nav-config";
import { cn, focusRing } from "@/lib/utils";

export function MobileNav({ items, pathname, auth }: { items: ShellNavItem[]; pathname: string; auth?: AuthState }) {
  const { t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const isClient = React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="icon" aria-expanded={open} aria-label={t("openMenu")} onClick={() => setOpen(true)}>
        <Menu className="size-5" aria-hidden />
      </Button>
      {isClient && open
        ? createPortal(
            <div className="fixed inset-0 z-[80] lg:hidden" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-surface-overlay"
                aria-label={t("closeMenu")}
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t("menu")}
                className="absolute inset-y-0 flex w-[min(20rem,100%)] flex-col gap-4 bg-surface-raised p-6 text-text shadow-lg"
                style={{ insetInlineStart: 0 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-title font-semibold">{t("menu")}</h2>
                  <button
                    type="button"
                    className={cn("rounded-control p-2 opacity-70 hover:opacity-100", focusRing)}
                    aria-label={t("closeMenu")}
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <nav aria-label={t("menu")} className="flex flex-col gap-1">
                  {items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      variant="stack"
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </nav>
                <div className="mt-auto flex flex-col gap-3">
                  <LanguageSwitcher />
                  <AuthStatus auth={auth} />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
