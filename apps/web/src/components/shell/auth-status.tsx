"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { isProtectedPath } from "@/lib/auth";
import { splitLocalePrefix, withLocalePrefix } from "@/lib/locale";

export type AuthState = { status: "guest" } | { status: "signed-in"; name: string };

export function AuthStatus({ auth }: { auth?: AuthState }) {
  const { t, locale } = useLocale();
  const pathname = usePathname() ?? "/";
  const path = splitLocalePrefix(pathname).pathname;
  const router = useRouter();
  const ctx = useAuth();
  const resolved = auth ?? ctx.auth;

  async function handleSignOut() {
    await ctx.signOut();
    if (isProtectedPath(path)) {
      router.replace(withLocalePrefix(locale, "/"));
    }
  }

  if (resolved.status === "signed-in") {
    return (
      <div className="flex items-center gap-2">
        <LocaleLink
          href="/settings"
          className="max-w-[10rem] truncate text-sm text-text hover:underline"
          title={resolved.name}
        >
          <span className="sr-only">{t("signedInAs")} </span>
          {resolved.name}
        </LocaleLink>
        <Button type="button" variant="ghost" size="sm" onClick={() => void handleSignOut()}>
          {t("signOut")}
        </Button>
      </div>
    );
  }

  const next =
    path.startsWith("/signin") ||
    path.startsWith("/signup") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/verify-email")
      ? withLocalePrefix(locale, "/")
      : pathname;

  return (
    <Button variant="outline" size="sm" asChild>
      <LocaleLink href={`/signin?next=${encodeURIComponent(next)}`}>{t("signIn")}</LocaleLink>
    </Button>
  );
}
