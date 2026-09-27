"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, MailCheck, MailOpen, MailX } from "lucide-react";
import { AuthLayout, type AuthVisual } from "@/components/auth/auth-layout";
import { EMAIL_PATTERN, isRateLimited } from "@/components/auth/auth-errors";
import {
  AuthAlert,
  AuthField,
  AuthResult,
  AuthSubmit,
  RESEND_COOLDOWN_SECONDS,
  SpamHelp,
  authInput,
  useCooldown,
} from "@/components/auth/auth-ui";
import { useAuth } from "@/components/shell/auth-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import { resendVerification, safeNextPath, verifyEmail } from "@/lib/auth";
import { useAuthCopy } from "@/lib/auth-copy";
import { withLocalePrefix } from "@/lib/locale";
import { cn, focusRing } from "@/lib/utils";

type Phase = "verifying" | "verified" | "bad-link" | "idle";

const quietLink = cn(
  "rounded-sm font-semibold text-text underline decoration-border underline-offset-4 hover:decoration-text",
  focusRing,
);

/** Moves focus to a new screen's heading so a screen reader announces the change. */
function useFocusHeading(key: string) {
  React.useEffect(() => {
    document.getElementById("verify-title")?.focus();
  }, [key]);
}

/**
 * Everything after sign-up: "check your email", following the link from that
 * email, and getting a new link. The API does not say whether a bad link was
 * expired or already used, so the screen does not guess either.
 */
export function VerifyEmailForm({ visual }: { visual?: AuthVisual | null }) {
  const copy = useAuthCopy();
  const { t, locale } = useLocale();
  const { user, ready, refresh, signOut } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const nextPath = safeNextPath(params.get("next"));
  const [phase, setPhase] = React.useState<Phase>(token ? "verifying" : "idle");
  const [guestEmail, setGuestEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const cooldown = useCooldown();

  React.useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void verifyEmail(token)
      .then(async () => {
        await refresh();
        if (!cancelled) setPhase("verified");
      })
      .catch(async () => {
        // A reused link for an address that is already verified is not a failure.
        await refresh();
        if (!cancelled) setPhase("bad-link");
      });
    return () => {
      cancelled = true;
    };
  }, [refresh, token]);

  const alreadyVerified = Boolean(user?.email_verified) && phase !== "verified" && phase !== "verifying";
  const screen: "verifying" | "verified" | "already" | "bad-link" | "check" | "guest" | "loading" =
    phase === "verifying"
      ? "verifying"
      : phase === "verified"
        ? "verified"
        : alreadyVerified
          ? "already"
          : phase === "bad-link"
            ? "bad-link"
            : !ready
              ? "loading"
              : user
                ? "check"
                : "guest";
  useFocusHeading(screen);

  async function resend(email?: string) {
    if (sending || cooldown.left > 0) return;
    setNotice(null);
    setSending(true);
    try {
      await resendVerification(email);
      setNotice({
        tone: "success",
        text: email ? copy.resentGeneric : interpolate(copy.resent, { email: user?.email ?? "" }),
      });
      cooldown.start(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setNotice({ tone: "danger", text: copy.resendFailed });
      if (isRateLimited(err)) cooldown.start(err.retryAfter ?? RESEND_COOLDOWN_SECONDS);
    } finally {
      setSending(false);
    }
  }

  function onGuestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!EMAIL_PATTERN.test(guestEmail.trim())) {
      setEmailError(copy.errEmail);
      document.getElementById("verify-email-address")?.focus();
      return;
    }
    void resend(guestEmail.trim());
  }

  const resendLabel = cooldown.left > 0 ? interpolate(copy.resendIn, { n: cooldown.left }) : copy.resend;
  const continueHref = nextPath;
  const continueButton = (
    <LocaleLink
      href={continueHref}
      className={cn(
        "group inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-[0.75rem] bg-brand px-5 text-[0.9375rem] font-semibold text-brand-foreground transition-colors duration-150 hover:bg-brand/90",
        focusRing,
      )}
    >
      {copy.continueToMshwar}
      <ArrowRight
        className="size-4 transition-transform duration-150 group-hover:translate-x-0.5 rtl:-scale-x-100"
        aria-hidden
      />
    </LocaleLink>
  );
  const noticeBlock = notice ? <AuthAlert tone={notice.tone}>{notice.text}</AuthAlert> : null;

  let body: React.ReactNode;
  if (screen === "verifying" || screen === "loading") {
    body = (
      <div className="grid gap-5" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-brand-subtle text-brand" aria-hidden>
          <Loader2 className="size-6 animate-spin" />
        </span>
        <h1 id="verify-title" tabIndex={-1} className="text-2xl font-[560] tracking-[-0.03em] outline-none">
          {screen === "verifying" ? copy.verifying : t("verifyEmail")}
        </h1>
      </div>
    );
  } else if (screen === "verified" || screen === "already") {
    body = (
      <AuthResult
        titleId="verify-title"
        tone="success"
        icon={<MailCheck />}
        title={screen === "verified" ? copy.verifiedTitle : copy.alreadyTitle}
      >
        <p className="text-[0.9375rem] leading-relaxed text-text-muted" role="status">
          {screen === "verified" ? copy.verifiedBody : copy.alreadyBody}
        </p>
        {continueButton}
      </AuthResult>
    );
  } else if (screen === "check") {
    const email = user?.email ?? "";
    body = (
      <AuthResult titleId="verify-title" icon={<MailOpen />} title={copy.checkTitle}>
        <div className="grid gap-1">
          <p className="text-[0.9375rem] text-text-muted">{copy.checkSentTo}</p>
          <p className="text-[1.0625rem] font-semibold text-text [overflow-wrap:anywhere]">{email}</p>
        </div>
        <p className="text-[0.9375rem] leading-relaxed text-text-muted">{copy.checkBody}</p>
        <SpamHelp email={email} />
        {noticeBlock}
        <AuthSubmit
          type="button"
          variant="secondary"
          pending={sending}
          pendingLabel={copy.resendPending}
          disabled={cooldown.left > 0}
          onClick={() => void resend()}
        >
          {resendLabel}
        </AuthSubmit>
        <div className="grid gap-2 text-sm text-text-muted">
          <p>
            {copy.wrongEmail}{" "}
            <button
              type="button"
              className={quietLink}
              onClick={() => void signOut().then(() => router.replace(withLocalePrefix(locale, "/signup")))}
            >
              {copy.useAnotherAccount}
            </button>
          </p>
          <p>
            <LocaleLink href={continueHref} className={quietLink}>
              {copy.continueForNow}
            </LocaleLink>
          </p>
        </div>
      </AuthResult>
    );
  } else {
    // A guest here either followed a bad link or wants a fresh one: ask for the address.
    body = (
      <AuthResult
        titleId="verify-title"
        tone={screen === "bad-link" ? "warning" : "brand"}
        icon={screen === "bad-link" ? <MailX /> : <MailOpen />}
        title={screen === "bad-link" ? copy.linkBadTitle : copy.guestTitle}
      >
        <p className="text-[0.9375rem] leading-relaxed text-text-muted">
          {screen === "bad-link" ? copy.linkBadBody : copy.guestBody}
        </p>
        {user ? (
          <>
            {noticeBlock}
            <AuthSubmit
              type="button"
              pending={sending}
              pendingLabel={copy.resendPending}
              disabled={cooldown.left > 0}
              onClick={() => void resend()}
            >
              {resendLabel}
            </AuthSubmit>
          </>
        ) : (
          <form className="grid gap-4" noValidate onSubmit={onGuestSubmit}>
            <AuthField id="verify-email-address" label={t("email")} error={emailError}>
              <input
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                className={authInput}
                value={guestEmail}
                onChange={(event) => {
                  setGuestEmail(event.target.value);
                  setEmailError(null);
                }}
              />
            </AuthField>
            {noticeBlock}
            <AuthSubmit pending={sending} pendingLabel={copy.resendPending} disabled={cooldown.left > 0}>
              {resendLabel}
            </AuthSubmit>
          </form>
        )}
        {notice?.tone === "success" ? <SpamHelp email={user?.email ?? (guestEmail.trim() || undefined)} /> : null}
      </AuthResult>
    );
  }

  return (
    <AuthLayout
      scene="verify"
      visual={visual}
      footer={
        screen === "verified" || screen === "already" || user ? null : (
          <LocaleLink className={quietLink} href="/signin">
            {copy.backToSignIn}
          </LocaleLink>
        )
      }
    >
      {body}
    </AuthLayout>
  );
}
