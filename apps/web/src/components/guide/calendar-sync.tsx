"use client";

import * as React from "react";
import { Check, Copy, Link2, Loader2, Plus, RefreshCw, Rss, Unlink } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import {
  addExternalCalendar,
  createFeed,
  fetchExternalCalendars,
  fetchFeedStatus,
  removeExternalCalendar,
  revokeFeed,
  syncExternalCalendars,
  type ExternalCalendar,
  type FeedStatus,
} from "@/lib/guide-workspace";
import { useGuideWorkspaceCopy } from "@/lib/guide-workspace-copy";

const MAX_CALENDARS = 3;

/** Two-way calendar: Mshwar in the guide's own calendar, and their busy time in Mshwar. */
export function CalendarSync() {
  const copy = useGuideWorkspaceCopy();
  return (
    <section
      aria-labelledby="sync-title"
      className="grid gap-6 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
    >
      <h2 id="sync-title" className="title-section flex items-center gap-2 text-[1.15rem]">
        <Link2 className="size-4 text-text-muted" aria-hidden />
        {copy.syncTitle}
      </h2>
      <FeedPanel />
      <ImportPanel />
    </section>
  );
}

function FeedPanel() {
  const copy = useGuideWorkspaceCopy();
  const { locale } = useLocale();
  const [status, setStatus] = React.useState<FeedStatus | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    fetchFeedStatus()
      .then((value) => {
        if (!cancelled) setStatus(value);
      })
      .catch(() => {
        if (!cancelled) setError(copy.loadError);
      });
    return () => {
      cancelled = true;
    };
  }, [copy.loadError]);

  async function act(action: () => Promise<FeedStatus>) {
    setPending(true);
    setError(null);
    setCopied(false);
    try {
      setStatus(await action());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  async function onCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-3">
      <h3 className="flex items-center gap-2 font-semibold">
        <Rss className="size-4 text-text-muted" aria-hidden />
        {copy.feedTitle}
      </h3>
      <p className="text-sm text-text-muted">{copy.feedBody}</p>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {status?.url ? (
        <div className="grid gap-2">
          <Notice tone="info">{copy.feedOnce}</Notice>
          <div className="flex flex-wrap gap-2">
            <Input
              readOnly
              aria-label={copy.feedTitle}
              value={status.url}
              className="min-w-0 flex-1 font-mono text-xs"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button type="button" variant="outline" onClick={() => void onCopy(status.url as string)}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? copy.copied : copy.copy}
            </Button>
          </div>
          <p className="text-xs text-text-muted">{copy.feedHow}</p>
        </div>
      ) : status?.active && status.created_at ? (
        <p className="text-sm">{interpolate(copy.feedActive, { date: formatDate(locale, status.created_at) })}</p>
      ) : null}
      {status ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => void act(createFeed)}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Rss aria-hidden />}
            {status.active ? copy.feedReplace : copy.feedCreate}
          </Button>
          {status.active ? (
            <Button type="button" variant="ghost" disabled={pending} onClick={() => void act(revokeFeed)}>
              {copy.feedRevoke}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ImportPanel() {
  const copy = useGuideWorkspaceCopy();
  const { locale } = useLocale();
  const [rows, setRows] = React.useState<ExternalCalendar[] | null>(null);
  const [url, setUrl] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchExternalCalendars()
      .then((value) => {
        if (!cancelled) setRows(Array.isArray(value) ? value : []);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setError(copy.loadError);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [copy.loadError]);

  async function act(name: string, action: () => Promise<ExternalCalendar[]>) {
    setPending(name);
    setError(null);
    try {
      setRows(await action());
      return true;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
      return false;
    } finally {
      setPending(null);
    }
  }

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (await act("add", () => addExternalCalendar(url.trim(), label.trim()))) {
      setUrl("");
      setLabel("");
    }
  }

  const full = (rows?.length ?? 0) >= MAX_CALENDARS;

  return (
    <div className="grid gap-3 border-t border-border-subtle pt-5">
      <h3 className="font-semibold">{copy.importTitle}</h3>
      <p className="text-sm text-text-muted">{copy.importBody}</p>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {rows === null ? (
        <Loader2 className="size-5 animate-spin text-text-muted" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">{copy.importEmpty}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm"
            >
              <span className="grid">
                <span className="font-medium">{row.label || row.host}</span>
                <span className={row.last_status === "failed" ? "text-danger" : "text-text-muted"}>
                  {row.last_status === "ok" && row.last_synced_at
                    ? interpolate(copy.importOk, {
                        n: String(row.events),
                        date: formatDate(locale, row.last_synced_at, {
                          dateStyle: undefined,
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })
                    : row.last_status === "failed"
                      ? interpolate(copy.importFailed, { error: row.last_error })
                      : copy.importPending}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending !== null}
                aria-label={`${copy.importRemove}: ${row.label || row.host}`}
                onClick={() => void act(`remove-${row.id}`, () => removeExternalCalendar(row.id))}
              >
                <Unlink aria-hidden />
                {copy.importRemove}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {rows?.length ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => void act("sync", syncExternalCalendars)}
          >
            <RefreshCw className={pending === "sync" ? "animate-spin" : undefined} aria-hidden />
            {copy.importSync}
          </Button>
        </div>
      ) : null}
      {full ? (
        <p className="text-sm text-text-muted">{copy.importMax}</p>
      ) : (
        <form className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]" onSubmit={onAdd}>
          <div className="grid gap-1.5">
            <Label htmlFor="calendar-url">{copy.importUrl}</Label>
            <Input
              id="calendar-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              required
              maxLength={1000}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="calendar-label">{copy.importLabel}</Label>
            <Input
              id="calendar-label"
              maxLength={60}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="outline" disabled={pending !== null || url.trim().length < 12}>
              {pending === "add" ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              {copy.importAdd}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
