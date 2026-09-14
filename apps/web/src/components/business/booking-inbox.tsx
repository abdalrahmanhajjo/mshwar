"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessCopy } from "@/lib/business-copy";
import { bookingsToCsv, filterBookings, listBookings, respondBooking, type PortalBooking } from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function BookingInbox() {
  const copy = useBusinessCopy();
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
    return <EmptyState title={copy.noOrgs} />;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{copy.inboxTitle}</CardTitle>
          <CardDescription>{copy.filters}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Input aria-label={copy.filters} value={query} onChange={(event) => setQuery(event.target.value)} />
          <Input
            aria-label="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder="pending"
          />
          <Button type="button" variant="outline" onClick={exportCsv}>
            {copy.exportCsv}
          </Button>
        </CardContent>
      </Card>
      <Tabs value={view} onValueChange={(value) => setView(value as "day" | "week" | "list")}>
        <TabsList>
          <TabsTrigger value="list">{copy.filters}</TabsTrigger>
          <TabsTrigger value="day">{copy.calendarDay}</TabsTrigger>
          <TabsTrigger value="week">{copy.calendarWeek}</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          {filtered.length === 0 ? (
            <EmptyState title={copy.emptyInbox} />
          ) : (
            <div className="grid gap-3">
              {filtered.map((row) => (
                <Card key={row.id}>
                  <CardHeader>
                    <CardTitle>
                      {row.experience_title} · {row.party_size}
                    </CardTitle>
                    <CardDescription>
                      {new Date(row.starts_at).toLocaleString()} · {row.status} · {copy.remaining} {row.remaining}/
                      {row.capacity}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-2">
                    <p className="text-sm">{row.traveller_note}</p>
                    <Label htmlFor={`reason-${row.id}`}>{copy.reason}</Label>
                    <Input id={`reason-${row.id}`} value={reason} onChange={(event) => setReason(event.target.value)} />
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" onClick={() => void respond(row.id, "confirmed")}>
                        {copy.confirm}
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => void respond(row.id, "rejected")}>
                        {copy.reject}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
    <ol className="grid gap-2">
      {rows.map((row) => (
        <li key={row.id} className="rounded-card border border-border p-3 text-sm">
          {new Date(row.starts_at).toLocaleString()} — {row.experience_title} ({remainingLabel} {row.remaining}/
          {row.capacity})
        </li>
      ))}
    </ol>
  );
}
