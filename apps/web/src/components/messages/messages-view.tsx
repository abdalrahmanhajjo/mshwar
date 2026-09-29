"use client";

import * as React from "react";
import { ArrowLeft, Flag, Loader2, Lock, MessagesSquare, Send, ShieldOff } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import {
  closeConversation,
  fetchConversation,
  fetchConversations,
  otherName,
  sendMessage,
  useMessagesCopy,
  type Conversation,
} from "@/lib/guide-messages";
import { cn, focusRing } from "@/lib/utils";

const POLL_MS = 30_000;

/** /messages: every conversation, newest first. */
export function MessagesInbox() {
  const copy = useMessagesCopy();
  const { locale } = useLocale();
  const [rows, setRows] = React.useState<Conversation[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchConversations()
        .then((result) => {
          if (!cancelled) setRows(Array.isArray(result) ? result : []);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="grid gap-6">
      <PageHeader icon={<MessagesSquare aria-hidden />} title={copy.title} description={copy.body} />
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : rows === null ? (
        <Loader2 className="mx-auto size-6 animate-spin text-text-muted" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-border-subtle p-8 text-center text-text-muted">
          {copy.empty}
        </p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <LocaleLink
                href={`/messages/${row.id}`}
                className={cn(
                  "grid gap-1 rounded-card border border-border-subtle bg-surface-raised p-4 transition-colors hover:border-brand/50",
                  row.unread ? "border-brand/40" : "",
                  focusRing,
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{otherName(row)}</span>
                  <span className="flex items-center gap-2 text-xs text-text-muted">
                    {row.unread ? (
                      <Badge variant="default">{interpolate(copy.unread, { n: String(row.unread) })}</Badge>
                    ) : null}
                    {formatDate(locale, row.last_message_at, { dateStyle: "medium" })}
                  </span>
                </span>
                {row.last ? <span className="truncate text-sm text-text-muted">{row.last}</span> : null}
              </LocaleLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** /messages/[id]: one conversation, refreshed every 30 seconds while open. */
export function ConversationThread({ id }: { id: string }) {
  const copy = useMessagesCopy();
  const { locale } = useLocale();
  const [thread, setThread] = React.useState<Conversation | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [closing, setClosing] = React.useState<null | "block" | "report">(null);
  const [reason, setReason] = React.useState("");
  const end = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetchConversation(id)
        .then((result) => {
          if (!cancelled) setThread(result);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  const count = thread?.messages?.length ?? 0;
  React.useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [count]);

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {copy.loadError}
      </Notice>
    );
  }
  if (!thread) {
    return <Loader2 className="mx-auto size-6 animate-spin text-text-muted" aria-hidden />;
  }

  async function onSend(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setPending(true);
    setError(null);
    try {
      setThread(await sendMessage(id, body));
      setDraft("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  async function onClose() {
    setPending(true);
    setError(null);
    try {
      setThread(await closeConversation(id, closing === "report", reason.trim()));
      setClosing(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  const time = (iso: string) =>
    formatDate(locale, iso, {
      dateStyle: undefined,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="grid gap-4">
      <LocaleLink
        href="/messages"
        className={cn("inline-flex w-fit items-center gap-1.5 text-sm text-text-muted hover:text-text", focusRing)}
      >
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {copy.back}
      </LocaleLink>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="title-page text-[1.6rem]">{otherName(thread)}</h1>
        {thread.blocked ? null : (
          <span className="flex gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => setClosing("block")}>
              <ShieldOff aria-hidden />
              {copy.block}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setClosing("report")}>
              <Flag aria-hidden />
              {copy.report}
            </Button>
          </span>
        )}
      </header>
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <Lock className="size-4 shrink-0" aria-hidden />
        {thread.contact_open ? copy.contactOpen : copy.contactClosed}
      </p>

      <ol className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-4" aria-live="polite">
        {(thread.messages ?? []).map((message) => (
          <li
            key={message.id}
            className={cn("grid max-w-[85%] gap-1", message.mine ? "justify-self-end text-end" : "justify-self-start")}
          >
            <span
              className={cn(
                "whitespace-pre-line rounded-card px-3.5 py-2 text-start",
                message.mine ? "bg-brand text-brand-foreground" : "bg-surface-sunken",
              )}
            >
              {message.body}
            </span>
            <span className="text-xs text-text-muted">
              {message.mine ? `${copy.you} · ` : ""}
              {time(message.created_at)}
            </span>
            {message.masked && message.mine ? <span className="text-xs text-text-muted">{copy.maskedNote}</span> : null}
          </li>
        ))}
      </ol>
      <div ref={end} aria-hidden />

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {closing ? (
        <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4">
          {closing === "report" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="report-reason">{copy.reportReason}</Label>
              <Textarea
                id="report-reason"
                rows={3}
                maxLength={2000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" disabled={pending} onClick={() => void onClose()}>
              {closing === "report" ? copy.reportSend : copy.blockSend}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setClosing(null)}>
              {copy.back}
            </Button>
          </div>
        </section>
      ) : null}

      {thread.blocked ? (
        <Notice tone="warning">{copy.blocked}</Notice>
      ) : (
        <form className="grid gap-2" onSubmit={onSend}>
          <Label htmlFor="message" className="sr-only">
            {copy.placeholder}
          </Label>
          <Textarea
            id="message"
            rows={3}
            maxLength={2000}
            placeholder={copy.placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div>
            <Button type="submit" disabled={pending || !draft.trim()}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {copy.send}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
