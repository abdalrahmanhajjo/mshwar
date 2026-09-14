"use client";

import * as React from "react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { securityFetch } from "@/lib/security";
import { fetchProfile } from "@/lib/profile";

export function PlanDefaultsNote() {
  const { t } = useLocale();
  const [summary, setSummary] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void securityFetch("/api/v1/privacy/consents", { credentials: "include" })
      .then(async response => {
        if (!response.ok || !(await response.json()).personalisation) return null;
        return fetchProfile();
      })
      .then((profile) => {
        if (cancelled || !profile) {
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
      <LocaleLink className="text-brand underline-offset-4 hover:underline" href="/settings">
        {t("profile")}
      </LocaleLink>
    </p>
  );
}
