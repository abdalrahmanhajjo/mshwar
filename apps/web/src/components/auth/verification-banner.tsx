"use client";

import Link from "next/link";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";

export function VerificationBanner() {
  const { user } = useAuth();
  const { t } = useLocale();
  if (!user || user.email_verified) {
    return null;
  }
  return (
    <div role="status" className="border-b border-border bg-surface-sunken px-4 py-2 text-center text-sm text-text">
      {t("unverifiedBanner")}{" "}
      <Link className="text-brand underline-offset-4 hover:underline" href="/verify-email">
        {t("verifyEmail")}
      </Link>
    </div>
  );
}
