"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { isAdminTier, isElevatedTier } from "@/lib/admin";
import { adminCopy } from "@/lib/admin-copy";
import { withLocalePrefix } from "@/lib/locale";

export function RequireAdmin({ children, elevated = false }: { children: React.ReactNode; elevated?: boolean }) {
  const { user, ready } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();
  const allowed = isAdminTier(user?.admin_tier) && (!elevated || isElevatedTier(user?.admin_tier));

  React.useEffect(() => {
    if (!ready || !user) {
      return;
    }
    if (!allowed) {
      router.replace(withLocalePrefix(locale, "/"));
    }
  }, [allowed, locale, ready, router, user]);

  if (!ready || !user || !allowed) {
    return (
      <p className="p-6 text-sm text-text-muted" role="status">
        {adminCopy[locale].notAdmin}
      </p>
    );
  }
  return children;
}
