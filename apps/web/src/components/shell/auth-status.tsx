"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { isProtectedPath } from "@/lib/auth";

export type AuthState = { status: "guest" } | { status: "signed-in"; name: string };

export function AuthStatus({ auth }: { auth?: AuthState }) {
  const { t } = useLocale();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const ctx = useAuth();
  const resolved = auth ?? ctx.auth;

  async function handleSignOut() {
    await ctx.signOut();
    if (isProtectedPath(pathname)) {
      router.replace("/");
    }
  }

  if (resolved.status === "signed-in") {
    return (
      <div className="flex items-center gap-2">
        <p className="max-w-[10rem] truncate text-sm text-text" title={resolved.name}>
          <span className="sr-only">{t("signedInAs")} </span>
          {resolved.name}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => void handleSignOut()}>
          {t("signOut")}
        </Button>
      </div>
    );
  }

  const next = pathname.startsWith("/signin") || pathname.startsWith("/signup") ? "/" : pathname;

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`/signin?next=${encodeURIComponent(next)}`}>{t("signIn")}</Link>
    </Button>
  );
}
