"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { AuthStatus, type AuthState } from "@/components/shell/auth-status";
import { NavLink } from "@/components/shell/nav-link";
import { useLocale } from "@/components/shell/locale-provider";
import type { ShellNavItem } from "@/components/shell/nav-config";

export function MobileNav({ items, pathname, auth }: { items: ShellNavItem[]; pathname: string; auth?: AuthState }) {
  const { t } = useLocale();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t("openMenu")}>
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="start" className="lg:hidden">
        <SheetHeader>
          <SheetTitle>{t("menu")}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t("menu")} className="flex flex-col gap-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} variant="stack" />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          <LanguageSwitcher />
          <AuthStatus auth={auth} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
