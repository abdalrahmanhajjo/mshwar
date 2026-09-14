"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocaleLink } from "@/components/shell/locale-link";
import { withLocalePrefix } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { registerAccount, safeNextPath, signInAccount } from "@/lib/auth";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const { t, locale } = useLocale();
  const { refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = safeNextPath(params.get("next"));
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "signup") {
        await registerAccount({
          email,
          password,
          display_name: displayName,
          locale,
        });
      } else {
        await signInAccount({ email, password });
      }
      await refresh();
      router.replace(withLocalePrefix(locale, nextPath));
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
        <CardTitle>{mode === "signup" ? t("signUp") : t("signIn")}</CardTitle>
        <CardDescription>{mode === "signup" ? t("passwordHint") : t("noAccount")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => void onSubmit(event)}
          aria-describedby={error ? "auth-error" : undefined}
        >
          {mode === "signup" ? (
            <Field id="display-name" label={t("displayName")}>
              <Input
                name="display_name"
                autoComplete="name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
          ) : null}
          <Field id="email" label={t("email")}>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field id="password" label={t("password")} description={mode === "signup" ? t("passwordHint") : undefined}>
            <Input
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 10 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {mode === "signin" ? (
            <p className="text-sm">
              <LocaleLink className="text-brand underline-offset-4 hover:underline" href="/forgot-password">
                {t("forgotPassword")}
              </LocaleLink>
            </p>
          ) : null}
          {error ? (
            <p id="auth-error" role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {mode === "signup" ? t("createAccount") : t("signIn")}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center text-sm text-text-muted">
        {mode === "signup" ? (
          <p>
            {t("haveAccount")}{" "}
            <LocaleLink
              className="text-brand underline-offset-4 hover:underline"
              href={`/signin?next=${encodeURIComponent(nextPath)}`}
            >
              {t("signIn")}
            </LocaleLink>
          </p>
        ) : (
          <p>
            {t("noAccount")}{" "}
            <LocaleLink
              className="text-brand underline-offset-4 hover:underline"
              href={`/signup?next=${encodeURIComponent(nextPath)}`}
            >
              {t("signUp")}
            </LocaleLink>
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
