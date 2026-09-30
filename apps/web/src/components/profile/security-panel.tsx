"use client";

import * as React from "react";
import { KeyRound, Laptop, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import {
  changePassword,
  describeDevice,
  endOtherSessions,
  endSession,
  fetchSessions,
  requestEmailChange,
  type AccountSession,
} from "@/lib/account-security";
import { useAccountSecurityCopy } from "@/lib/account-security-copy";

/** Settings → Sign-in and security: sessions, password and email. Passwords stay in memory only. */
export function SecurityPanel() {
  const copy = useAccountSecurityCopy();
  return (
    <section
      id="security"
      className="scroll-mt-28 overflow-hidden rounded-card border border-border-subtle bg-surface-raised shadow-sm"
      aria-labelledby="security-heading"
    >
      <header className="grid gap-1.5 p-6 md:p-7">
        <h2 id="security-heading" className="title-card flex items-center gap-2">
          <ShieldCheck className="size-5 text-text-muted" aria-hidden />
          {copy.title}
        </h2>
        <p className="text-sm leading-relaxed text-text-muted">{copy.body}</p>
      </header>
      <div className="divide-y divide-border-subtle border-t border-border-subtle">
        <SessionsBlock />
        <PasswordBlock />
        <EmailBlock />
      </div>
    </section>
  );
}

function useMessage() {
  const copy = useAccountSecurityCopy();
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);
  const fail = (caught: unknown) => setError(caught instanceof ApiError ? caught.message : copy.error);
  return { error, setError, done, setDone, fail };
}

function Messages({ error, done }: { error: string | null; done: string | null }) {
  return (
    <>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {done ? (
        <Notice tone="success" role="status">
          {done}
        </Notice>
      ) : null}
    </>
  );
}

function SessionsBlock() {
  const copy = useAccountSecurityCopy();
  const { locale } = useLocale();
  const [sessions, setSessions] = React.useState<AccountSession[] | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const { error, setError, done, setDone, fail } = useMessage();

  React.useEffect(() => {
    let cancelled = false;
    fetchSessions()
      .then((rows) => {
        if (!cancelled) setSessions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(name: string, action: () => Promise<string | null>) {
    setPending(name);
    setError(null);
    setDone(null);
    try {
      const message = await action();
      setSessions(await fetchSessions());
      if (message) setDone(message);
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(null);
    }
  }

  const others = (sessions ?? []).filter((session) => !session.current).length;

  return (
    <div className="grid gap-4 p-6 md:px-7">
      <div className="grid gap-1">
        <h3 className="flex items-center gap-2 font-semibold">
          <Laptop className="size-4 text-text-muted" aria-hidden />
          {copy.sessionsTitle}
        </h3>
        <p className="text-sm text-text-muted">{copy.sessionsBody}</p>
      </div>
      <Messages error={error} done={done} />
      {sessions === null ? (
        <Loader2 className="size-5 animate-spin text-text-muted" aria-hidden />
      ) : (
        <ul className="grid gap-2">
          {sessions.map((session) => (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm"
            >
              <span className="grid">
                <span className="flex items-center gap-2 font-medium">
                  {describeDevice(session.user_agent) ?? copy.unknownDevice}
                  {session.current ? <Badge variant="outline">{copy.thisDevice}</Badge> : null}
                </span>
                <span className="text-text-muted">
                  {interpolate(copy.lastActive, {
                    date: formatDate(locale, session.last_seen_at, {
                      dateStyle: undefined,
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </span>
              </span>
              {session.current ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending !== null}
                  aria-label={`${copy.endSession}: ${describeDevice(session.user_agent) ?? copy.unknownDevice}`}
                  onClick={() =>
                    void act(session.id, async () => {
                      await endSession(session.id);
                      return null;
                    })
                  }
                >
                  <LogOut aria-hidden />
                  {copy.endSession}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {others > 0 ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() =>
              void act("others", async () => {
                const result = await endOtherSessions();
                return interpolate(copy.endedOthers, { n: String(result.revoked) });
              })
            }
          >
            {pending === "others" ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
            {copy.endOthers}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function PasswordBlock() {
  const copy = useAccountSecurityCopy();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [repeat, setRepeat] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { error, setError, done, setDone, fail } = useMessage();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);
    if (next !== repeat) {
      setError(copy.mismatch);
      return;
    }
    setPending(true);
    try {
      const result = await changePassword(current, next);
      setDone(interpolate(copy.passwordDone, { n: String(result.sessions_revoked) }));
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 p-6 md:px-7" onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-1">
        <h3 className="flex items-center gap-2 font-semibold">
          <KeyRound className="size-4 text-text-muted" aria-hidden />
          {copy.passwordTitle}
        </h3>
        <p className="text-sm text-text-muted">{copy.passwordBody}</p>
      </div>
      <Messages error={error} done={done} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="current-password">{copy.currentPassword}</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-password">{copy.newPassword}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            value={next}
            onChange={(event) => setNext(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="repeat-password">{copy.confirmPassword}</Label>
          <Input
            id="repeat-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
        </div>
      </div>
      <div>
        <Button type="submit" disabled={pending || !current || next.length < 10}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.passwordSave}
        </Button>
      </div>
    </form>
  );
}

function EmailBlock() {
  const copy = useAccountSecurityCopy();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { error, setError, done, setDone, fail } = useMessage();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);
    setPending(true);
    try {
      const result = await requestEmailChange(email.trim(), password);
      setDone(interpolate(copy.emailSent, { email: result.sent_to }));
      setPassword("");
    } catch (caught) {
      fail(caught);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4 p-6 md:px-7" onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-1">
        <h3 className="flex items-center gap-2 font-semibold">
          <Mail className="size-4 text-text-muted" aria-hidden />
          {copy.emailTitle}
        </h3>
        <p className="text-sm text-text-muted">{copy.emailBody}</p>
      </div>
      <Messages error={error} done={done} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="new-email">{copy.newEmail}</Label>
          <Input
            id="new-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email-password">{copy.currentPassword}</Label>
          <Input
            id="email-password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </div>
      <div>
        <Button type="submit" variant="outline" disabled={pending || !email.trim() || !password}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.emailSave}
        </Button>
      </div>
    </form>
  );
}
