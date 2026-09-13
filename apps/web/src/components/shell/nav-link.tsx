"use client";

import Link from "next/link";
import { cn, controlSize, focusRing } from "@/lib/utils";
import { isNavActive, type ShellNavItem } from "@/components/shell/nav-config";
import { useLocale } from "@/components/shell/locale-provider";

export function NavLink({
  item,
  pathname,
  variant = "inline",
  onNavigate,
}: {
  item: ShellNavItem;
  pathname: string;
  variant?: "inline" | "stack";
  onNavigate?: () => void;
}) {
  const { t } = useLocale();
  const active = isNavActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "inline-flex items-center gap-2 rounded-control px-3 text-sm font-medium",
        controlSize,
        focusRing,
        variant === "stack" && "w-full justify-start",
        active ? "bg-surface-sunken text-text" : "text-text-muted hover:bg-surface-sunken hover:text-text",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {t(item.labelKey)}
    </Link>
  );
}
