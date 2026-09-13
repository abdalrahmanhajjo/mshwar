"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      router.replace(nextPath);
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
        <form className="grid gap-4" onSubmit={(event) => void onSubmit(event)}>
          {mode === "signup" ? (
            <div className="grid gap-2">
              <Label htmlFor="display-name">{t("displayName")}</Label>
              <Input
                id="display-name"
                name="display_name"
                autoComplete="name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
          ) : null}
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
          <div className="grid gap-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={mode === "signup" ? 10 : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-danger">
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
            <Link
              className="text-brand underline-offset-4 hover:underline"
              href={`/signin?next=${encodeURIComponent(nextPath)}`}
            >
              {t("signIn")}
            </Link>
          </p>
        ) : (
          <p>
            {t("noAccount")}{" "}
            <Link
              className="text-brand underline-offset-4 hover:underline"
              href={`/signup?next=${encodeURIComponent(nextPath)}`}
            >
              {t("signUp")}
            </Link>
          </p>
        )}
      </CardFooter>
    </Card>
  );
}
