"use client";

import { LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS } from "@/lib/locale";
import { cn, controlSize, focusRing } from "@/lib/utils";
import { useLocale } from "@/components/shell/locale-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();

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
            onClick={() => setLocale(item)}
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
