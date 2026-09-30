"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocaleLink } from "@/components/shell/locale-link";
import { withLocalePrefix } from "@/lib/locale";
import { AuthLayout, type AuthVisual } from "@/components/auth/auth-layout";
import { authErrorMessage, EMAIL_PATTERN, PASSWORD_MAX, PASSWORD_MIN } from "@/components/auth/auth-errors";
import { AuthAlert, AuthField, AuthSubmit, PasswordInput, Requirement, authInput } from "@/components/auth/auth-ui";
import { HumanCheck, humanCheckEnabled } from "@/components/auth/human-check";
import { useAuth } from "@/components/shell/auth-provider";
import { useLocale } from "@/components/shell/locale-provider";
import { ApiError } from "@/lib/api/client";
import { registerAccount, safeNextPath, signInAccount } from "@/lib/auth";
import { useAuthCopy } from "@/lib/auth-copy";
import { LEGAL_VERSIONS } from "@/lib/legal/types";
import { useTrustCopy } from "@/lib/trust-copy";
import { cn, focusRing } from "@/lib/utils";

const inlineLink = cn(
  "rounded-sm font-semibold text-text underline decoration-border underline-offset-4 hover:decoration-text",
  focusRing,
);

function ConsentCheckbox({
  id,
  checked,
  onChange,
  children,
  describedBy,
  required,
  invalid,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
  describedBy?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 cursor-pointer"
        checked={checked}
        required={required}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-text">
        {children}
      </label>
    </div>
  );
}

type Errors = Partial<Record<"name" | "email" | "password" | "terms" | "human", string>>;

export function AuthForm({ mode, visual }: { mode: "signin" | "signup"; visual?: AuthVisual | null }) {
  const { t, locale } = useLocale();
  const copy = useAuthCopy();
  const trust = useTrustCopy();
  const { refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = safeNextPath(params.get("next"));
  // "Stay inspired" on the homepage hands the address over; nothing is ticked for them.
  const [email, setEmail] = React.useState(() => params.get("email")?.slice(0, 254) ?? "");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  // Nothing is pre-ticked: terms are required, the other two are optional choices (MSHWAR-113).
  const [acceptTerms, setAcceptTerms] = React.useState(false);
  const [personalisation, setPersonalisation] = React.useState(false);
  const [marketing, setMarketing] = React.useState(false);
  const [humanToken, setHumanToken] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<React.ReactNode>(null);
  const [pending, setPending] = React.useState(false);
  const inFlight = React.useRef(false);
  const signup = mode === "signup";

  function validate(): Errors {
    const next: Errors = {};
    if (signup && !displayName.trim()) next.name = copy.errName;
    if (!EMAIL_PATTERN.test(email.trim())) next.email = copy.errEmail;
    if (signup && password.length < PASSWORD_MIN) next.password = copy.errPassword;
    if (!signup && !password) next.password = copy.errPassword;
    if (signup && !acceptTerms) next.terms = copy.errTerms;
    if (signup && humanCheckEnabled && !humanToken) next.human = copy.errHumanCheck;
    return next;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setFormError(null);
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      const target = { name: "display-name", email: "email", password: "password", terms: "accept-terms" }[first];
      document.getElementById(target ?? "")?.focus();
      if (found.human) setFormError(found.human);
      return;
    }
    inFlight.current = true;
    setPending(true);
    try {
      if (signup) {
        await registerAccount({
          email: email.trim(),
          password,
          display_name: displayName.trim(),
          locale,
          accept_terms: acceptTerms,
          policy_versions: { terms: LEGAL_VERSIONS.terms, privacy: LEGAL_VERSIONS.privacy },
          personalisation_consent: personalisation,
          marketing_consent: marketing,
          human_check: humanToken,
        });
        await refresh();
        // A new account is signed in but not yet verified: show where the link went.
        const query = new URLSearchParams({ sent: "1", next: nextPath });
        router.replace(withLocalePrefix(locale, `/verify-email?${query}`));
      } else {
        await signInAccount({ email: email.trim(), password });
        await refresh();
        router.replace(withLocalePrefix(locale, nextPath));
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErrors({ email: copy.errEmailTaken });
        setFormError(
          <>
            {copy.errEmailTaken}{" "}
            <LocaleLink href={`/signin?next=${encodeURIComponent(nextPath)}`} className={inlineLink}>
              {copy.errEmailTakenSignIn}
            </LocaleLink>{" "}
            ·{" "}
            <LocaleLink href="/forgot-password" className={inlineLink}>
              {copy.errEmailTakenReset}
            </LocaleLink>
          </>,
        );
      } else if (err instanceof ApiError && err.status === 401) {
        setFormError(copy.errWrongCredentials);
      } else {
        setFormError(authErrorMessage(err, copy, signup ? "errNetwork" : "errNetworkSignIn"));
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  const clear = (key: keyof Errors) =>
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));

  const footer = signup ? (
    <p>
      {copy.haveAccount}{" "}
      <LocaleLink className={inlineLink} href={`/signin?next=${encodeURIComponent(nextPath)}`}>
        {copy.signInLink}
      </LocaleLink>
    </p>
  ) : (
    <p>
      {copy.newHere}{" "}
      <LocaleLink className={inlineLink} href={`/signup?next=${encodeURIComponent(nextPath)}`}>
        {copy.createLink}
      </LocaleLink>
    </p>
  );

  return (
    <AuthLayout
      scene={signup ? "signup" : "signin"}
      visual={visual}
      title={signup ? copy.suTitle : copy.siTitle}
      description={signup ? copy.suBody : copy.siBody}
      footer={footer}
    >
      <form
        className="grid gap-5"
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        aria-describedby={formError ? "auth-error" : undefined}
      >
        {signup ? (
          <AuthField id="display-name" label={t("displayName")} error={errors.name}>
            <input
              name="display_name"
              autoComplete="name"
              maxLength={80}
              required
              className={authInput}
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                clear("name");
              }}
            />
          </AuthField>
        ) : null}
        <AuthField id="email" label={t("email")} error={errors.email}>
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
              clear("email");
            }}
          />
        </AuthField>
        <AuthField
          id="password"
          label={t("password")}
          error={errors.password}
          labelAside={
            signup ? null : (
              <LocaleLink href="/forgot-password" className={cn(inlineLink, "text-sm font-medium")}>
                {copy.siForgot}
              </LocaleLink>
            )
          }
          hint={
            signup ? <Requirement met={password.length >= PASSWORD_MIN}>{copy.pwRuleLength}</Requirement> : undefined
          }
        >
          <PasswordInput
            name="password"
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? PASSWORD_MIN : undefined}
            maxLength={PASSWORD_MAX}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clear("password");
            }}
          />
        </AuthField>

        {signup ? (
          <fieldset className="grid gap-4 border-t border-border-subtle pt-5">
            <legend className="sr-only">{trust.acceptLead}</legend>
            <div className="grid gap-2">
              <ConsentCheckbox
                id="accept-terms"
                required
                invalid={Boolean(errors.terms)}
                describedBy={errors.terms ? "accept-terms-error" : undefined}
                checked={acceptTerms}
                onChange={(value) => {
                  setAcceptTerms(value);
                  if (value) clear("terms");
                }}
              >
                {trust.acceptLead}{" "}
                <LocaleLink href="/terms" target="_blank" className={inlineLink}>
                  {trust.termsLink}
                </LocaleLink>{" "}
                {trust.acceptJoin}{" "}
                <LocaleLink href="/privacy" target="_blank" className={inlineLink}>
                  {trust.privacyLink}
                </LocaleLink>
                {trust.acceptEnd}{" "}
                <span className="ms-1 whitespace-nowrap rounded-pill bg-brand-subtle px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-brand">
                  {copy.required}
                </span>
              </ConsentCheckbox>
              {errors.terms ? (
                <p id="accept-terms-error" className="ps-8 text-[0.8125rem] font-medium text-danger">
                  {errors.terms}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 rounded-[0.875rem] bg-surface-sunken px-4 py-3.5">
              <p id="consent-optional" className="text-xs text-text-muted">
                <span className="font-semibold uppercase tracking-[0.08em] text-text">{copy.optional}</span> ·{" "}
                {copy.suOptionalHeading}
              </p>
              <ConsentCheckbox
                id="consent-personalisation"
                describedBy="consent-optional"
                checked={personalisation}
                onChange={setPersonalisation}
              >
                {trust.signupPersonalisation}
              </ConsentCheckbox>
              <ConsentCheckbox
                id="consent-marketing"
                describedBy="consent-optional"
                checked={marketing}
                onChange={setMarketing}
              >
                {trust.signupMarketing}
              </ConsentCheckbox>
            </div>
          </fieldset>
        ) : null}

        {signup ? <HumanCheck action="register" onToken={setHumanToken} /> : null}

        {formError ? <AuthAlert id="auth-error">{formError}</AuthAlert> : null}

        <AuthSubmit pending={pending} pendingLabel={signup ? copy.suPending : copy.siPending}>
          {signup ? copy.suSubmit : copy.siSubmit}
        </AuthSubmit>
      </form>
    </AuthLayout>
  );
}
