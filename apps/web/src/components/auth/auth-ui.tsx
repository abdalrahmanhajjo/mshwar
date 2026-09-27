"use client";

import * as React from "react";
import { AlertCircle, Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuthCopy } from "@/lib/auth-copy";
import { cn, focusRing } from "@/lib/utils";

/** One input look for every auth field: tall, calm, with a clear focus ring. */
export const authInput = cn(
  "block h-[3.25rem] w-full rounded-[0.75rem] border border-border bg-surface-raised px-4 text-[0.9375rem] text-text",
  "transition-[border-color,box-shadow] duration-150 placeholder:text-text-muted/70 hover:border-border-strong",
  "focus-visible:border-brand focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand/15",
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/15",
);

type ControlProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Label, control, hint and error wired together: the control gets the id,
 * aria-invalid and aria-describedby, so a screen reader hears the hint and the error.
 */
export function AuthField({
  id,
  label,
  labelAside,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  /** Something that sits at the end of the label row, like "Forgot password?". */
  labelAside?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactElement<ControlProps>;
}) {
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}
        </label>
        {labelAside}
      </div>
      {React.cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <div id={hintId ?? undefined} className="text-[0.8125rem] text-text-muted">
          {hint}
        </div>
      ) : null}
      {error ? (
        <p id={errorId ?? undefined} className="flex items-start gap-1.5 text-[0.8125rem] font-medium text-danger">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A password input with its own Show / Hide control. The value, the focus and the
 * caret all survive the switch; the control never submits the form.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(function PasswordInput({ className, ...props }, forwarded) {
  const copy = useAuthCopy();
  const [visible, setVisible] = React.useState(false);
  const inner = React.useRef<HTMLInputElement | null>(null);
  const caret = React.useRef<[number, number] | null>(null);

  React.useImperativeHandle(forwarded, () => inner.current as HTMLInputElement);

  React.useLayoutEffect(() => {
    const input = inner.current;
    const saved = caret.current;
    if (input && saved && document.activeElement === input) {
      input.setSelectionRange(saved[0], saved[1]);
    }
    caret.current = null;
  }, [visible]);

  function toggle() {
    const input = inner.current;
    if (input && document.activeElement === input) {
      caret.current = [input.selectionStart ?? input.value.length, input.selectionEnd ?? input.value.length];
    }
    setVisible((value) => !value);
  }

  return (
    <div className="relative">
      <input
        ref={inner}
        type={visible ? "text" : "password"}
        spellCheck={false}
        autoCapitalize="none"
        className={cn(authInput, "pe-14", className)}
        {...props}
      />
      <button
        type="button"
        onClick={toggle}
        // A mouse click keeps the caret in the field; keyboard users keep focus on the button.
        onMouseDown={(event) => event.preventDefault()}
        aria-label={visible ? copy.pwHide : copy.pwShow}
        aria-pressed={visible}
        aria-controls={props.id}
        className={cn(
          "absolute inset-y-1 end-1 grid w-11 place-items-center rounded-[0.625rem] text-text-muted transition-colors duration-150 hover:bg-surface-sunken hover:text-text",
          focusRing,
        )}
      >
        {visible ? <EyeOff className="size-[1.15rem]" aria-hidden /> : <Eye className="size-[1.15rem]" aria-hidden />}
      </button>
    </div>
  );
});

/** A requirement line that turns green when it is met. */
export function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  const copy = useAuthCopy();
  return (
    <span className={cn("inline-flex items-center gap-1.5 transition-colors duration-150", met && "text-success")}>
      <span
        className={cn(
          "grid size-4 place-items-center rounded-full border transition-colors duration-150",
          met ? "border-success bg-success text-success-foreground" : "border-border-strong",
        )}
        aria-hidden
      >
        {met ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </span>
      {children}
      <span className="sr-only">({met ? copy.pwRuleMet : copy.pwRuleUnmet})</span>
    </span>
  );
}

/** The one primary action on an auth screen. Pending keeps the width and blocks a second submit. */
export function AuthSubmit({
  pending,
  pendingLabel,
  children,
  disabled,
  type = "submit",
  onClick,
  variant = "primary",
}: {
  pending?: boolean;
  pendingLabel?: string;
  children: React.ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex h-[3.25rem] w-full items-center justify-center gap-2 rounded-[0.75rem] px-5 text-[0.9375rem] font-semibold transition-[background-color,border-color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed",
        variant === "primary"
          ? "bg-brand text-brand-foreground hover:bg-brand/90 disabled:bg-brand/60"
          : "border border-border bg-surface-raised text-text hover:border-brand/40 hover:bg-brand-subtle disabled:text-text-muted disabled:hover:border-border disabled:hover:bg-surface-raised",
        focusRing,
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** A form-level message. Errors are announced; successes are polite status updates. */
export function AuthAlert({
  tone = "danger",
  id,
  children,
}: {
  tone?: "danger" | "success";
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-[0.75rem] border px-4 py-3 text-sm leading-relaxed",
        tone === "danger"
          ? "border-danger/25 bg-danger-subtle text-danger"
          : "border-success/25 bg-success-subtle text-success",
      )}
    >
      {tone === "danger" ? (
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** What to try when an email hasn't arrived. Visible, but quieter than the main action. */
export function SpamHelp({ email }: { email?: string }) {
  const copy = useAuthCopy();
  return (
    <div className="rounded-[0.875rem] bg-surface-sunken px-4 py-3.5 text-sm">
      <p className="font-semibold text-text">{copy.spamTitle}</p>
      <ul className="mt-1.5 grid gap-1 text-text-muted">
        <li className="flex gap-2">
          <span aria-hidden>•</span>
          <span>
            <strong className="font-semibold text-text">{copy.spamFolder.split(" — ")[0]}</strong>
            {copy.spamFolder.includes(" — ") ? ` — ${copy.spamFolder.split(" — ").slice(1).join(" — ")}` : null}
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>•</span>
          <span>
            {email ? (
              <>
                {copy.spamAddress.split("{email}")[0]}
                <span className="font-medium text-text [overflow-wrap:anywhere]">{email}</span>
                {copy.spamAddress.split("{email}")[1]}
              </>
            ) : (
              copy.spamAddressGeneric
            )}
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden>•</span>
          <span>{copy.spamWait}</span>
        </li>
      </ul>
    </div>
  );
}

/** Seconds left before an action may run again; start() begins a new wait. */
export function useCooldown() {
  const [left, setLeft] = React.useState(0);
  React.useEffect(() => {
    if (left <= 0) return;
    const timer = window.setTimeout(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  const start = React.useCallback((seconds: number) => setLeft(Math.max(1, Math.round(seconds))), []);
  return { left, start };
}

export const RESEND_COOLDOWN_SECONDS = 45;

/** A finished or failed step: an icon, what happened, and what to do next. */
export function AuthResult({
  icon,
  tone = "brand",
  title,
  children,
  titleId,
}: {
  icon: React.ReactNode;
  tone?: "brand" | "success" | "warning";
  title: string;
  children?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <div className="grid gap-5">
      <span
        className={cn(
          "grid size-12 place-items-center rounded-full [&_svg]:size-6",
          tone === "success" && "bg-success-subtle text-success",
          tone === "warning" && "bg-accent-subtle text-accent-strong",
          tone === "brand" && "bg-brand-subtle text-brand",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <h1
        id={titleId}
        tabIndex={-1}
        className="text-[clamp(1.75rem,1.45rem+1vw,2.25rem)] font-[560] leading-[1.1] tracking-[-0.035em] text-text outline-none"
      >
        {title}
      </h1>
      {children}
    </div>
  );
}
