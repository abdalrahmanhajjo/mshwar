"use client";

import { useLocale } from "@/components/shell/locale-provider";

export default function NotFound() {
  const { t } = useLocale();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface p-24 text-text">
      <h1 className="text-display font-bold">404</h1>
      <p className="mt-4 text-title text-text-muted">{t("notFound")}</p>
      <p className="mt-2 text-sm text-text-muted">{t("notFoundBody")}</p>
    </main>
  );
}
