"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { requestPasswordReset, resetPassword } from "@/lib/auth";
import { withLocalePrefix } from "@/lib/locale";

export function RecoveryForm({ mode }: { mode: "forgot" | "reset" }) {
  const { t, locale } = useLocale();
  const { refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onForgot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("authError");
      setError(message === "authError" ? t("authError") : message);
    } finally {
      setPending(false);
    }
  }

  async function onReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await resetPassword({ token, password });
      await refresh();
      router.replace(withLocalePrefix(locale, "/"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("authError");
      if (message === "Invalid or expired reset link") {
        setError(t("invalidReset"));
      } else {
        setError(message === "authError" ? t("authError") : message);
      }
    } finally {
      setPending(false);
    }
  }

  if (mode === "reset" && !token) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("resetPassword")}</CardTitle>
          <CardDescription>{t("invalidReset")}</CardDescription>
        </CardHeader>
        <CardFooter className="justify-center text-sm text-text-muted">
          <LocaleLink className="text-brand underline-offset-4 hover:underline" href="/signin">
            {t("backToSignIn")}
          </LocaleLink>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === "forgot" ? t("forgotPassword") : t("resetPassword")}</CardTitle>
        <CardDescription>{mode === "forgot" ? t("forgotHint") : t("passwordHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "forgot" && sent ? (
          <p role="status" className="text-sm text-text">
            {t("resetSent")}
          </p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => void (mode === "forgot" ? onForgot(event) : onReset(event))}
          >
            {mode === "forgot" ? (
              <div className="grid gap-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="new-password">{t("newPassword")}</Label>
                <Input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            )}
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {mode === "forgot" ? t("sendResetLink") : t("updatePassword")}
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
