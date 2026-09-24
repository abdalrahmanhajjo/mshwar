"use client";

import * as React from "react";
import { CheckCircle2, KeyRound, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { ApiError } from "@/lib/api/client";
import {
  beginAuthenticator,
  confirmAuthenticator,
  confirmPhone,
  startPhoneCheck,
  type SecurityStatus,
} from "@/lib/partners";
import { useVerifiedCopy } from "@/lib/verified-copy";

/** Groups a base32 key in fours so it can be typed without losing your place. */
export function groupKey(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * The two factors every partner account needs before an application goes in:
 * a phone confirmed by a texted code, and an authenticator app.
 */
export function SecurityPanel({
  status,
  onChange,
}: {
  status: SecurityStatus;
  onChange: (next: SecurityStatus) => void;
}) {
  const copy = useVerifiedCopy();
  const [phone, setPhone] = React.useState(status.phone ?? "");
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [phoneCode, setPhoneCode] = React.useState("");
  const [editingPhone, setEditingPhone] = React.useState(!status.phone_verified);
  const [setup, setSetup] = React.useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [totpCode, setTotpCode] = React.useState("");
  const [busy, setBusy] = React.useState<null | "send" | "phone" | "totp-start" | "totp">(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(kind: NonNullable<typeof busy>, task: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 422 && caught.message === "That code is not right"
            ? copy.wrongCode
            : caught.message
          : copy.loadError,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="security-title"
      className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
    >
      <div className="grid gap-1">
        <h2 id="security-title" className="title-section text-[1.2rem]">
          {copy.securityTitle}
        </h2>
        <p className="text-sm text-text-muted">{copy.securityBody}</p>
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      <div className="grid gap-3">
        <h3 className="flex items-center gap-2 font-medium">
          <Smartphone className="size-4 text-text-muted" aria-hidden />
          {copy.phoneLabel}
        </h3>
        {status.phone_verified && !editingPhone ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-sm text-success" role="status">
              <CheckCircle2 className="size-4" aria-hidden />
              {interpolate(copy.phoneVerified, { phone: status.phone ?? "" })}
            </p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditingPhone(true)}>
              {copy.changePhone}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5 sm:max-w-sm">
              <Label htmlFor="partner-phone">{copy.phoneLabel}</Label>
              <Input
                id="partner-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                aria-describedby="partner-phone-hint"
              />
              <p id="partner-phone-hint" className="text-xs text-text-muted">
                {copy.phoneHint}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={busy !== null || phone.replace(/\D/g, "").length < 8}
              onClick={() =>
                void run("send", async () => {
                  const sent = await startPhoneCheck(phone);
                  setSentTo(sent.sent_to);
                })
              }
            >
              {busy === "send" ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {copy.sendCode}
            </Button>
            {sentTo ? (
              <form
                className="grid gap-2 sm:max-w-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run("phone", async () => {
                    const next = await confirmPhone(phoneCode);
                    onChange({
                      phone: next.phone,
                      phone_verified: next.phone_verified,
                      totp_enabled: next.totp_enabled,
                      totp_pending: next.totp_pending,
                    });
                    setEditingPhone(false);
                    setSentTo(null);
                    setPhoneCode("");
                  });
                }}
              >
                <p className="text-sm text-text-muted" role="status">
                  {interpolate(copy.codeSent, { phone: sentTo })}
                </p>
                <Label htmlFor="partner-phone-code">{copy.codeLabel}</Label>
                <div className="flex gap-2">
                  <Input
                    id="partner-phone-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={8}
                    value={phoneCode}
                    onChange={(event) => setPhoneCode(event.target.value)}
                  />
                  <Button type="submit" disabled={busy !== null || phoneCode.replace(/\D/g, "").length !== 6}>
                    {busy === "phone" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                    {copy.confirm}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        )}
      </div>

      <div className="grid gap-3 border-t border-border-subtle pt-5">
        <h3 className="flex items-center gap-2 font-medium">
          <KeyRound className="size-4 text-text-muted" aria-hidden />
          {copy.totpTitle}
        </h3>
        {status.totp_enabled ? (
          <p className="flex items-center gap-2 text-sm text-success" role="status">
            <CheckCircle2 className="size-4" aria-hidden />
            {copy.totpOn}
          </p>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-text-muted">{copy.totpBody}</p>
            {setup ? (
              <form
                className="grid gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run("totp", async () => {
                    onChange(await confirmAuthenticator(totpCode));
                    setSetup(null);
                  });
                }}
              >
                <p className="text-sm">{copy.totpScan}</p>
                <a href={setup.otpauth_uri} className="w-fit text-sm font-medium underline">
                  {copy.totpOpen}
                </a>
                <p className="text-sm">
                  <span className="text-text-muted">{copy.totpKey}: </span>
                  <code
                    dir="ltr"
                    className="select-all rounded bg-surface-sunken px-2 py-1 font-mono text-sm tracking-wider"
                  >
                    {groupKey(setup.secret)}
                  </code>
                </p>
                <div className="grid gap-1.5 sm:max-w-xs">
                  <Label htmlFor="partner-totp-code">{copy.codeLabel}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="partner-totp-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={8}
                      value={totpCode}
                      onChange={(event) => setTotpCode(event.target.value)}
                    />
                    <Button type="submit" disabled={busy !== null || totpCode.replace(/\D/g, "").length !== 6}>
                      {busy === "totp" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                      {copy.confirm}
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-fit"
                disabled={busy !== null}
                onClick={() => void run("totp-start", async () => setSetup(await beginAuthenticator()))}
              >
                {busy === "totp-start" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {copy.totpStart}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
