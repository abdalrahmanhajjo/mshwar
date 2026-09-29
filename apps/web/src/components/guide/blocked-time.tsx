"use client";

import * as React from "react";
import { Ban, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { useLocale } from "@/components/shell/locale-provider";
import { formatDate } from "@/i18n/format";
import { ApiError } from "@/lib/api/client";
import { useGuideScheduleCopy } from "@/lib/guide-schedule-copy";
import { beirutInstant } from "@/lib/guide-schedule";
import { addBlock, deleteBlock, fetchBlocks, type BusyBlock } from "@/lib/guide-work";

/** Time the guide cannot work: listed, added by date and hours, removed in one tap. */
export function BlockedTime() {
  const copy = useGuideScheduleCopy();
  const { locale } = useLocale();
  const [rows, setRows] = React.useState<BusyBlock[] | null>(null);
  const [date, setDate] = React.useState("");
  const [from, setFrom] = React.useState("09:00");
  const [to, setTo] = React.useState("13:00");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      // Imported busy time is shown in the month view and summarised per calendar, not here.
      setRows((await fetchBlocks()).filter((block) => block.kind === "manual"));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
      setRows([]);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    fetchBlocks()
      .then((loaded) => {
        if (!cancelled) {
          setRows(Array.isArray(loaded) ? loaded.filter((block) => block.kind === "manual") : []);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : String(caught));
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const when = (block: BusyBlock) => {
    const start = formatDate(locale, block.starts_at, {
      dateStyle: undefined,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Beirut",
    });
    const end = formatDate(locale, block.ends_at, {
      dateStyle: undefined,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Beirut",
    });
    return `${start} – ${end}`;
  };

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!date || !from || !to || to <= from) {
      setError(copy.blockInvalid);
      return;
    }
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      await addBlock({ starts_at: beirutInstant(date, from), ends_at: beirutInstant(date, to), note: note.trim() });
      setNotice(copy.blockAdded);
      setNote("");
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    } finally {
      setPending(false);
    }
  }

  async function onRemove(block: BusyBlock) {
    setError(null);
    try {
      await deleteBlock(block.id);
      await reload();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String(caught));
    }
  }

  return (
    <section
      aria-labelledby="blocked-title"
      className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
    >
      <h2 id="blocked-title" className="title-section flex items-center gap-2 text-[1.15rem]">
        <Ban className="size-4 text-text-muted" aria-hidden />
        {copy.blocksTitle}
      </h2>
      <p className="text-sm text-text-muted">{copy.blocksBody}</p>
      {notice ? (
        <Notice tone="success" role="status">
          {notice}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {rows === null ? (
        <Loader2 className="size-5 animate-spin text-text-muted" aria-hidden />
      ) : rows.length === 0 ? (
        <p className="text-sm text-text-muted">{copy.blocksEmpty}</p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((block) => (
            <li
              key={block.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle bg-surface px-3 py-2 text-sm"
            >
              <span className="grid">
                <span className="font-medium tabular-nums">{when(block)}</span>
                {block.note ? <span className="text-text-muted">{block.note}</span> : null}
              </span>
              {block.kind === "manual" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`${copy.blockRemove}: ${when(block)}`}
                  onClick={() => void onRemove(block)}
                >
                  <X aria-hidden />
                  {copy.blockRemove}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-[10rem_7rem_7rem_1fr_auto]"
        onSubmit={onAdd}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="block-date">{copy.blockDate}</Label>
          <Input id="block-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="block-from">{copy.blockFrom}</Label>
          <Input id="block-from" type="time" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="block-to">{copy.blockTo}</Label>
          <Input id="block-to" type="time" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="block-note">{copy.blockNote}</Label>
          <Input id="block-note" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
            {copy.blockAdd}
          </Button>
        </div>
      </form>
    </section>
  );
}
