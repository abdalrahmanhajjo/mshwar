"use client";

import * as React from "react";
import Link from "next/link";
import { useLocale } from "@/components/shell/locale-provider";
import { fetchProfile } from "@/lib/profile";

export function PlanDefaultsNote() {
  const { t } = useLocale();
  const [summary, setSummary] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }
        const size = profile.preferences.default_group_size;
        const area = profile.home_area?.name;
        const parts = [area, size ? `${t("groupSize")} ${size}` : null].filter(Boolean);
        setSummary(parts.join(" · ") || t("nextPlanUsesDefaults"));
      })
      .catch(() => {
        if (!cancelled) {
          setSummary(t("nextPlanUsesDefaults"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <p className="text-sm text-text-muted">
      {summary}{" "}
      <Link className="text-brand underline-offset-4 hover:underline" href="/settings">
        {t("profile")}
      </Link>
    </p>
  );
}
