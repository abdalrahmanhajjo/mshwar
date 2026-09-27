"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS, withLocalePrefix } from "@/lib/locale";
import { persistSignedInLocale } from "@/lib/profile";
import { cn, focusRing } from "@/lib/utils";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();
  const { user } = useAuth();
  const pathname = usePathname() ?? "/";
  const router = useRouter();

  function onSelect(next: (typeof LOCALES)[number]) {
    setLocale(next);
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.push(withLocalePrefix(next, `${pathname}${search}`));
    if (user) {
      void persistSignedInLocale(next);
    }
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex items-center rounded-pill border border-border-subtle bg-surface-raised p-0.5",
        !compact && "w-full",
      )}
    >
      {LOCALES.map((item) => {
        const active = item === locale;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={active}
            aria-label={LOCALE_LABELS[item]}
            onClick={() => onSelect(item)}
            className={cn(
              // Slightly narrower below 360px so the header fits beside the logo on small phones.
              "inline-flex h-8 min-w-8 items-center justify-center rounded-pill px-1.5 text-xs font-semibold tracking-wide transition-colors min-[360px]:min-w-9 min-[360px]:px-2",
              !compact && "h-10 flex-1 text-sm",
              focusRing,
              active ? "bg-brand text-brand-foreground" : "text-text-muted hover:bg-surface-sunken hover:text-text",
            )}
          >
            {compact ? LOCALE_SHORT_LABELS[item] : LOCALE_LABELS[item]}
          </button>
        );
      })}
    </div>
  );
}
