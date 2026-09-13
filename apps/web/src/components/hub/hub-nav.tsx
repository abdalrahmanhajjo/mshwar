"use client";

import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { cn, focusRing } from "@/lib/utils";

const HUB_LINKS = [
  { href: "/trips", key: "myTrips" as const },
  { href: "/favorites", key: "favorites" as const },
  { href: "/bookings", key: "bookings" as const },
  { href: "/notifications", key: "notifications" as const },
];

export function HubNav({ current }: { current: string }) {
  const { t } = useLocale();
  return (
    <nav aria-label={t("menu")} className="flex flex-wrap gap-2">
      {HUB_LINKS.map((item) => {
        const active = current === item.href;
        return (
          <LocaleLink
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-pill border px-3 py-2 text-sm min-h-[var(--layout-min-target)] inline-flex items-center",
              focusRing,
              active ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface-raised text-text",
            )}
          >
            {t(item.key)}
          </LocaleLink>
        );
      })}
    </nav>
  );
}
