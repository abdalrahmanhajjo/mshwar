"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  CalendarRange,
  Check,
  Clock,
  Download,
  Inbox,
  List,
  MessageSquareQuote,
  Search,
  X,
} from "lucide-react";
import { BOOKING_STATUS_VARIANT } from "@/lib/status";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency } from "@/i18n/format";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessCopy } from "@/lib/business-copy";
import { bookingsToCsv, filterBookings, listBookings, respondBooking, type PortalBooking } from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function BookingInbox() {
  const copy = useBusinessCopy();
  const { locale } = useLocale();
  const { org } = usePortal();
  const [rows, setRows] = React.useState<PortalBooking[]>([]);
  const [status, setStatus] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [reason, setReason] = React.useState("Confirmed from inbox");
  const [view, setView] = React.useState<"day" | "week" | "list">("list");

  const reload = React.useCallback(async () => {
    if (!org) {
      return;
    }
    try {
      setRows(await listBookings(org.id));
    } catch {
      setRows([]);
    }
  }, [org]);

  React.useEffect(() => {
    if (!org) {
      return;
    }
    let cancelled = false;
    void listBookings(org.id)
      .then((next) => {
        if (!cancelled) {
          setRows(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [org]);

  const filtered = filterBookings(rows, { status: status || undefined, query: query || undefined });

  async function respond(id: string, next: "confirmed" | "rejected") {
    if (!org) {
      return;
    }
    await respondBooking(org.id, id, {
      status: next,
      reason,
      message: next === "confirmed" ? "See you soon." : undefined,
    });
    await reload();
  }

  function exportCsv() {
    const blob = new Blob([bookingsToCsv(filtered)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bookings.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!org) {
    return <EmptyState icon={<Inbox aria-hidden />} title={copy.noOrgs} />;
  }

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={copy.portalKicker} title={copy.inboxTitle} description={copy.inboxHint} />
      <div className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-sunken/70 p-3 md:flex-row md:items-center md:p-4">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <Input
            aria-label={copy.filters}
            placeholder={copy.searchLabel}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="border-border-subtle ps-10"
          />
        </div>
        <NativeSelect
          aria-label="status"
          wrapperClassName="md:w-48"
          className="border-border-subtle"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">{copy.anyStatus}</option>
          {["pending", "confirmed", "rejected", "cancelled", "completed"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </NativeSelect>
        <Button type="button" variant="outline" onClick={exportCsv}>
          <Download aria-hidden />
          {copy.exportCsv}
        </Button>
      </div>
      <Tabs value={view} onValueChange={(value) => setView(value as "day" | "week" | "list")}>
        <TabsList>
          <TabsTrigger value="list">
            <List className="size-4" aria-hidden />
            {copy.listView}
          </TabsTrigger>
          <TabsTrigger value="day">
            <CalendarDays className="size-4" aria-hidden />
            {copy.calendarDay}
          </TabsTrigger>
          <TabsTrigger value="week">
            <CalendarRange className="size-4" aria-hidden />
            {copy.calendarWeek}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          {filtered.length === 0 ? (
            <EmptyState icon={<Inbox aria-hidden />} title={copy.emptyInbox} />
          ) : (
            <ul className="grid gap-4">
              {filtered.map((row) => {
                const start = new Date(row.starts_at);
                return (
                  <li
                    key={row.id}
                    className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm md:grid-cols-[4.5rem_1fr] md:p-6"
                  >
                    <div className="grid h-fit w-[4.5rem] justify-items-center rounded-control bg-brand text-brand-foreground">
                      <span className="pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] opacity-75">
                        {start.toLocaleDateString(locale, { month: "short" })}
                      </span>
                      <span className="pb-2 text-3xl font-semibold leading-tight tabular-nums">{start.getDate()}</span>
                    </div>
                    <div className="grid gap-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="grid gap-1">
                          <h2 className="title-card">
                            {row.experience_title} · {row.party_size}
                          </h2>
                          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3.5" aria-hidden />
                              {start.toLocaleString()}
                            </span>
                            <span>
                              {copy.remaining} {row.remaining}/{row.capacity}
                            </span>
                            {row.total_minor ? (
                              <span className="font-medium text-text">
                                {formatCurrency(locale, row.total_minor / 100, row.currency || "USD")}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <Badge variant={BOOKING_STATUS_VARIANT[row.status] ?? "secondary"}>{row.status}</Badge>
                      </div>
                      {row.traveller_note ? (
                        <blockquote className="flex gap-2 rounded-control bg-surface-sunken px-4 py-3 text-sm">
                          <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden />
                          {row.traveller_note}
                        </blockquote>
                      ) : null}
                      <div className="grid gap-3 border-t border-border-subtle pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                        <div className="grid gap-2">
                          <Label htmlFor={`reason-${row.id}`}>{copy.reason}</Label>
                          <Input
                            id={`reason-${row.id}`}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" onClick={() => void respond(row.id, "confirmed")}>
                            <Check aria-hidden />
                            {copy.confirm}
                          </Button>
                          <Button type="button" variant="outline" onClick={() => void respond(row.id, "rejected")}>
                            <X aria-hidden />
                            {copy.reject}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="day">
          <CalendarList rows={filtered} remainingLabel={copy.remaining} />
        </TabsContent>
        <TabsContent value="week">
          <CalendarList rows={filtered} remainingLabel={copy.remaining} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CalendarList({ rows, remainingLabel }: { rows: PortalBooking[]; remainingLabel: string }) {
  return (
    <ol className="divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-surface-raised">
      {rows.map((row) => (
        <li key={row.id} className="grid gap-1 px-5 py-4 text-sm sm:grid-cols-[14rem_1fr_auto] sm:items-center">
          <span className="font-medium tabular-nums">{new Date(row.starts_at).toLocaleString()}</span>
          <span>{row.experience_title}</span>
          <span className="text-text-muted">
            {remainingLabel} {row.remaining}/{row.capacity}
          </span>
        </li>
      ))}
    </ol>
  );
}
