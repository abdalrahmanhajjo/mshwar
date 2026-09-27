"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, KeyRound, LinkIcon, MailOpen } from "lucide-react";
import { AuthLayout, type AuthVisual } from "@/components/auth/auth-layout";
import {
  authErrorMessage,
  EMAIL_PATTERN,
  isRateLimited,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "@/components/auth/auth-errors";
import {
  AuthAlert,
  AuthField,
  AuthResult,
  AuthSubmit,
  PasswordInput,
  RESEND_COOLDOWN_SECONDS,
  Requirement,
  SpamHelp,
  authInput,
  useCooldown,
} from "@/components/auth/auth-ui";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import { ApiError } from "@/lib/api/client";
import { requestPasswordReset, resetPassword } from "@/lib/auth";
import { useAuthCopy } from "@/lib/auth-copy";
import { cn, focusRing } from "@/lib/utils";

const quietLink = cn(
  "rounded-sm font-semibold text-text underline decoration-border underline-offset-4 hover:decoration-text",
  focusRing,
);

const primaryLink = cn(
  "group inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-[0.75rem] bg-brand px-5 text-[0.9375rem] font-semibold text-brand-foreground transition-colors duration-150 hover:bg-brand/90",
  focusRing,
);

function focusTitle() {
  window.requestAnimationFrame(() => document.getElementById("recovery-title")?.focus());
}

function ForgotPassword({ visual }: { visual?: AuthVisual | null }) {
  const copy = useAuthCopy();
  const { t } = useLocale();
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [resent, setResent] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const cooldown = useCooldown();

  async function send(address: string, again: boolean) {
    if (pending) return;
    setError(null);
    setPending(true);
    try {
      await requestPasswordReset(address);
      setSentTo(address);
      setResent(again);
      cooldown.start(RESEND_COOLDOWN_SECONDS);
      if (!again) focusTitle();
    } catch (err) {
      setError(authErrorMessage(err, copy));
      if (isRateLimited(err)) cooldown.start(err.retryAfter ?? RESEND_COOLDOWN_SECONDS);
    } finally {
      setPending(false);
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (!EMAIL_PATTERN.test(address)) {
      setEmailError(copy.errEmail);
      document.getElementById("email")?.focus();
      return;
    }
    void send(address, false);
  }

  const footer = (
    <LocaleLink className={quietLink} href="/signin">
      {copy.backToSignIn}
    </LocaleLink>
  );

  if (sentTo) {
    return (
      <AuthLayout scene="recover" visual={visual} footer={footer}>
        <AuthResult titleId="recovery-title" icon={<MailOpen />} title={copy.fpSentTitle}>
          <p role="status" className="text-[0.9375rem] leading-relaxed text-text-muted">
            {copy.fpSentBody}
          </p>
          <p className="text-[1.0625rem] font-semibold text-text [overflow-wrap:anywhere]">{sentTo}</p>
          <SpamHelp email={sentTo} />
          {resent && !error ? <AuthAlert tone="success">{copy.fpResent}</AuthAlert> : null}
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <AuthSubmit
            type="button"
            variant="secondary"
            pending={pending}
            pendingLabel={copy.fpPending}
            disabled={cooldown.left > 0}
            onClick={() => void send(sentTo, true)}
          >
            {cooldown.left > 0 ? interpolate(copy.resendIn, { n: cooldown.left }) : copy.fpResend}
          </AuthSubmit>
          <p className="text-sm">
            <button
              type="button"
              className={quietLink}
              onClick={() => {
                setSentTo(null);
                setResent(false);
                setError(null);
              }}
            >
              {copy.fpOtherEmail}
            </button>
          </p>
        </AuthResult>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout scene="recover" visual={visual} title={copy.fpTitle} description={copy.fpBody} footer={footer}>
      <form className="grid gap-5" noValidate onSubmit={onSubmit}>
        <AuthField id="email" label={t("email")} error={emailError}>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={254}
            required
            className={authInput}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError(null);
            }}
          />
        </AuthField>
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <AuthSubmit pending={pending} pendingLabel={copy.fpPending} disabled={cooldown.left > 0}>
          {cooldown.left > 0 ? interpolate(copy.resendIn, { n: cooldown.left }) : copy.fpSubmit}
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}

function ResetPassword({ token, visual }: { token: string; visual?: AuthVisual | null }) {
  const copy = useAuthCopy();
  const { refresh } = useAuth();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<{ password?: string; confirm?: string }>({});
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"form" | "done" | "bad-link">(token ? "form" : "bad-link");
  const [pending, setPending] = React.useState(false);
  const inFlight = React.useRef(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const found: typeof errors = {};
    if (password.length < PASSWORD_MIN) found.password = copy.errPassword;
    if (confirm !== password) found.confirm = copy.errConfirm;
    setErrors(found);
    if (found.password || found.confirm) {
      document.getElementById(found.password ? "new-password" : "confirm-password")?.focus();
      return;
    }
    inFlight.current = true;
    setError(null);
    setPending(true);
    try {
      await resetPassword({ token, password });
      await refresh();
      setState("done");
      focusTitle();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setState("bad-link");
        focusTitle();
      } else {
        setError(authErrorMessage(err, copy));
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  if (state === "bad-link") {
    return (
      <AuthLayout
        scene="recover"
        visual={visual}
        footer={
          <LocaleLink className={quietLink} href="/signin">
            {copy.backToSignIn}
          </LocaleLink>
        }
      >
        <AuthResult titleId="recovery-title" tone="warning" icon={<LinkIcon />} title={copy.rpBadTitle}>
          <p className="text-[0.9375rem] leading-relaxed text-text-muted">{copy.rpBadBody}</p>
          <LocaleLink href="/forgot-password" className={primaryLink}>
            {copy.rpRequest}
          </LocaleLink>
        </AuthResult>
      </AuthLayout>
    );
  }

  if (state === "done") {
    return (
      <AuthLayout scene="recover" visual={visual}>
        <AuthResult titleId="recovery-title" tone="success" icon={<KeyRound />} title={copy.rpDoneTitle}>
          <p role="status" className="text-[0.9375rem] leading-relaxed text-text-muted">
            {copy.rpDoneBody}
          </p>
          <LocaleLink href="/" className={primaryLink}>
            {copy.continueToMshwar}
            <ArrowRight
              className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 rtl:-scale-x-100"
              aria-hidden
            />
          </LocaleLink>
        </AuthResult>
      </AuthLayout>
    );
  }

  const matches = confirm.length > 0 && confirm === password;
  return (
    <AuthLayout
      scene="recover"
      visual={visual}
      title={copy.rpTitle}
      description={copy.rpBody}
      footer={
        <LocaleLink className={quietLink} href="/signin">
          {copy.backToSignIn}
        </LocaleLink>
      }
    >
      <form className="grid gap-5" noValidate onSubmit={(event) => void onSubmit(event)}>
        <AuthField
          id="new-password"
          label={copy.rpNew}
          error={errors.password}
          hint={<Requirement met={password.length >= PASSWORD_MIN}>{copy.pwRuleLength}</Requirement>}
        >
          <PasswordInput
            name="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
          />
        </AuthField>
        <AuthField
          id="confirm-password"
          label={copy.rpConfirm}
          error={errors.confirm}
          hint={
            confirm && !errors.confirm ? (
              <span aria-live="polite">
                {matches ? (
                  <Requirement met>{copy.pwMatch}</Requirement>
                ) : (
                  <span className="text-text-muted">{copy.pwNoMatch}</span>
                )}
              </span>
            ) : undefined
          }
        >
          <PasswordInput
            name="password_confirm"
            autoComplete="new-password"
            required
            maxLength={PASSWORD_MAX}
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setErrors((current) => ({ ...current, confirm: undefined }));
            }}
          />
        </AuthField>
        {error ? <AuthAlert>{error}</AuthAlert> : null}
        <AuthSubmit pending={pending} pendingLabel={copy.rpPending}>
          {copy.rpSubmit}
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}

export function RecoveryForm({ mode, visual }: { mode: "forgot" | "reset"; visual?: AuthVisual | null }) {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  return mode === "forgot" ? (
    <ForgotPassword visual={visual} />
  ) : (
    <ResetPassword key={token} token={token} visual={visual} />
  );
}
