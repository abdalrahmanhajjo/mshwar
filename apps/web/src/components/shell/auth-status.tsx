"use client";

import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/shell/locale-provider";

export type AuthState = { status: "guest" } | { status: "signed-in"; name: string };

export function AuthStatus({ auth = { status: "guest" } }: { auth?: AuthState }) {
  const { t } = useLocale();

  if (auth.status === "signed-in") {
    return (
      <p className="max-w-[10rem] truncate text-sm text-text" title={auth.name}>
        <span className="sr-only">{t("signedInAs")} </span>
        {auth.name}
      </p>
    );
  }

  return (
    <Button variant="outline" size="sm">
      {t("signIn")}
    </Button>
  );
}
