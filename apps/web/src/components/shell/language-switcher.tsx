"use client";

import { LOCALES, LOCALE_LABELS, LOCALE_SHORT_LABELS, parseLocale } from "@/lib/locale";
import { cn, controlSize, focusRing } from "@/lib/utils";
import { useLocale } from "@/components/shell/locale-provider";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="inline-flex min-w-0 flex-col">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(event) => setLocale(parseLocale(event.target.value))}
        className={cn(
          "rounded-control border border-border bg-surface-raised px-2 text-sm text-text",
          compact ? "w-[4.75rem]" : "min-w-[9rem]",
          focusRing,
          controlSize,
        )}
      >
        {LOCALES.map((item) => (
          <option key={item} value={item}>
            {compact ? LOCALE_SHORT_LABELS[item] : LOCALE_LABELS[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
