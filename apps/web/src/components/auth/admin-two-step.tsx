"use client";

import * as React from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { apiRequest } from "@/lib/api/client";
import { adminCopy } from "@/lib/admin-copy";

type MfaState = { required: boolean; enrolled: boolean; verified: boolean; verified_until: string | null };

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/**
 * The console's second step (SR-14): set up an authenticator once, then a code per session every
 * 12 hours. The API refuses every admin route until then; this screen only makes that easy.
 */
export function AdminTwoStep({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const copy = adminCopy[locale];
  const [state, setState] = React.useState<MfaState | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [setup, setSetup] = React.useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [confirmed, setConfirmed] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [wrong, setWrong] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    apiRequest<MfaState>("/api/v1/admin/mfa")
      .then((next) => !cancelled && setState(next))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // If the state cannot be read, the API still guards every admin route; show the console and let it answer.
  if (failed || (state && (!state.required || state.verified))) return children;
  if (!state) {
    return <Loader2 className="m-6 size-6 animate-spin text-text-muted" aria-label={copy.twoStepTitle} />;
  }

  const enrolling = !state.enrolled && !confirmed;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setWrong(false);
    try {
      if (enrolling) {
        await apiRequest("/api/v1/partners/security/totp/confirm", json({ code }));
        setConfirmed(true);
      } else {
        setState(await apiRequest<MfaState>("/api/v1/admin/mfa/verify", json({ code })));
      }
      setCode("");
    } catch {
      setWrong(true);
    } finally {
      setBusy(false);
    }
  }

  async function begin() {
    setBusy(true);
    try {
      setSetup(
        await apiRequest<{ secret: string; otpauth_uri: string }>("/api/v1/partners/security/totp", { method: "POST" }),
      );
    } catch {
      setWrong(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-md gap-5 p-6">
      <div className="grid gap-2">
        <h1 className="title-card inline-flex items-center gap-2">
          <ShieldCheck className="size-5" aria-hidden />
          {enrolling ? copy.twoStepSetupTitle : copy.twoStepTitle}
        </h1>
        <p className="text-sm text-text-muted">{enrolling ? copy.twoStepSetupBody : copy.twoStepBody}</p>
      </div>
      {enrolling && !setup ? (
        <Button type="button" className="w-fit" disabled={busy} onClick={() => void begin()}>
          <KeyRound aria-hidden />
          {copy.twoStepStart}
        </Button>
      ) : null}
      {enrolling && setup ? (
        <div className="grid gap-2 rounded-card border border-border-subtle p-4">
          <p className="text-sm font-medium">{copy.twoStepKey}</p>
          <code className="break-all font-mono text-sm tracking-wider" dir="ltr">
            {setup.secret.match(/.{1,4}/g)?.join(" ")}
          </code>
          <a href={setup.otpauth_uri} className="text-sm underline underline-offset-2">
            {copy.twoStepOpenApp}
          </a>
        </div>
      ) : null}
      {confirmed ? <Notice tone="success">{copy.twoStepNext}</Notice> : null}
      {!enrolling || setup ? (
        <form className="grid gap-3" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-1.5">
            <Label htmlFor="two-step-code">{copy.twoStepCode}</Label>
            <Input
              id="two-step-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          {wrong ? (
            <Notice tone="danger" role="alert">
              {copy.twoStepWrong}
            </Notice>
          ) : null}
          <Button type="submit" className="w-fit" disabled={busy || code.length !== 6}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {copy.twoStepConfirm}
          </Button>
        </form>
      ) : null}
      <p className="text-xs text-text-muted">{copy.twoStepLost}</p>
    </main>
  );
}
