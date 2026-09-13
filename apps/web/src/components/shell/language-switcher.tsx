"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS, withLocalePrefix } from "@/lib/locale";
import { persistSignedInLocale } from "@/lib/profile";
import { cn, controlSize, focusRing } from "@/lib/utils";
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
    <div role="group" aria-label={t("language")} className="inline-flex rounded-control border border-border">
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
              "px-2 text-sm font-medium",
              controlSize,
              focusRing,
              active ? "bg-brand text-brand-foreground" : "bg-surface-raised text-text hover:bg-surface-sunken",
            )}
          >
            {compact ? LOCALE_SHORT_LABELS[item] : LOCALE_LABELS[item]}
          </button>
        );
      })}
    </div>
  );
}
