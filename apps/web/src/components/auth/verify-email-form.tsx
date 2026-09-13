"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { resendVerification, verifyEmail } from "@/lib/auth";

export function VerifyEmailForm() {
  const { t } = useLocale();
  const { user, refresh } = useAuth();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [verified, setVerified] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(() => Boolean(token));
  const emailValue = email || user?.email || "";

  React.useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;
    void verifyEmail(token)
      .then(async () => {
        if (cancelled) {
          return;
        }
        await refresh();
        setVerified(true);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : t("authError");
        setError(message === "Invalid or expired verification link" ? t("invalidVerify") : message);
      })
      .finally(() => {
        if (!cancelled) {
          setPending(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, t, token]);

  async function onResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await resendVerification(emailValue);
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("authError");
      setError(message === "authError" ? t("authError") : message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{t("verifyEmail")}</CardTitle>
        <CardDescription role={verified || sent ? "status" : undefined}>
          {verified ? t("emailVerified") : sent ? t("verificationSent") : t("verifyEmailHint")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {verified || sent ? null : (
          <form className="grid gap-4" onSubmit={(event) => void onResend(event)}>
            <div className="grid gap-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={emailValue}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            {pending && token ? <p className="text-sm text-text-muted">{t("verifyEmail")}</p> : null}
            <Button type="submit" disabled={pending}>
              {t("resendVerification")}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center text-sm text-text-muted">
        <LocaleLink className="text-brand underline-offset-4 hover:underline" href="/signin">
          {t("backToSignIn")}
        </LocaleLink>
      </CardFooter>
    </Card>
  );
}
