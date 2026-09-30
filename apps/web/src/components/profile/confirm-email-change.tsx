"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { confirmEmailChange } from "@/lib/account-security";
import { useAccountSecurityCopy } from "@/lib/account-security-copy";

/** /account/confirm-email?token=…: finishes an email change from the link sent to the new address. */
export function ConfirmEmailChange() {
  const copy = useAccountSecurityCopy();
  const token = useSearchParams().get("token") ?? "";
  const [result, setResult] = React.useState<{ email: string } | "failed" | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (token.length < 8) {
      return;
    }
    confirmEmailChange(token)
      .then((value) => {
        if (!cancelled) setResult(value);
      })
      .catch(() => {
        if (!cancelled) setResult("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const failed = result === "failed" || token.length < 8;
  return (
    <div className="mx-auto grid max-w-lg gap-5 py-10">
      <h1 className="title-page text-[1.8rem]">{copy.confirmTitle}</h1>
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.confirmFailed}
        </Notice>
      ) : result === null ? (
        <p className="flex items-center gap-2 text-text-muted" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {copy.confirming}
        </p>
      ) : (
        <p className="flex items-center gap-2 font-medium" role="status">
          <CheckCircle2 className="size-5 text-success" aria-hidden />
          {interpolate(copy.confirmed, { email: result.email })}
        </p>
      )}
      <div>
        <Button asChild variant="outline">
          <LocaleLink href="/settings#security">{copy.goSettings}</LocaleLink>
        </Button>
      </div>
    </div>
  );
}
