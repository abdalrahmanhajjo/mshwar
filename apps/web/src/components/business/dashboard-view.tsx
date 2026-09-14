"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessCopy, CHECKLIST_LABELS } from "@/lib/business-copy";
import { createOrganization, getMetrics, metricDelta, metricsToCsv, type PortalMetrics } from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function DashboardView() {
  const copy = useBusinessCopy();
  const { org, orgs, refresh, ready } = usePortal();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [metrics, setMetrics] = React.useState<PortalMetrics | null>(null);
  const [from, setFrom] = React.useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));

  React.useEffect(() => {
    if (!org || org.role === "inventory" || org.role === "bookings") {
      return;
    }
    let cancelled = false;
    void getMetrics(org.id, `${from}T00:00:00.000Z`, `${to}T23:59:59.000Z`)
      .then((row) => {
        if (!cancelled) {
          setMetrics(row);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMetrics(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [from, org, to]);

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await createOrganization(name);
      await refresh();
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.createOrg);
    } finally {
      setPending(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-text-muted">{copy.onboarding}</p>;
  }

  if (!org) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{copy.registerTitle}</CardTitle>
          <CardDescription>{copy.registerHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={onCreate}>
            <Label htmlFor="org-name">{copy.orgName}</Label>
            <Input id="org-name" value={name} onChange={(event) => setName(event.target.value)} required />
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {copy.createOrg}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {org.name}
            <Badge variant={org.verification === "verified" ? "success" : "warning"}>
              {org.verification === "verified" ? copy.verifiedBadge : org.verification}
            </Badge>
          </CardTitle>
          <CardDescription>
            {orgs.length} · {org.role}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {org.verification !== "verified" ? (
            <p role="status" className="text-sm text-warning">
              {copy.pendingBanner}
            </p>
          ) : null}
          <h2 className="text-heading">{copy.checklist}</h2>
          <ul className="grid gap-1 text-sm">
            {org.onboarding.items.map((item) => (
              <li key={item.key} className="flex justify-between gap-3">
                <span>{copy[CHECKLIST_LABELS[item.key] ?? "itemOrg"]}</span>
                <span>{item.done ? "✓" : "–"}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {metrics ? (
        <Card>
          <CardHeader>
            <CardTitle>{copy.metricsTitle}</CardTitle>
            <CardDescription>{copy.comparison}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                aria-label={copy.comparison}
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
              <Input
                aria-label={copy.metricsTitle}
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const blob = new Blob([metricsToCsv(metrics)], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "metrics.csv";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                {copy.exportCsv}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["views", copy.views],
                  ["saves", copy.saves],
                  ["itinerary_inclusions", copy.inclusions],
                  ["requests", copy.requests],
                  ["confirmations", copy.confirmations],
                  ["revenue_minor", copy.revenue],
                ] as const
              ).map(([key, label]) => {
                const current = metrics.current[key] ?? 0;
                const previous = metrics.previous[key] ?? 0;
                const peak = Math.max(current, previous, 1);
                return (
                  <div key={key} className="rounded-card border border-border p-3">
                    <p className="text-label text-text-muted">{label}</p>
                    <p className="text-title">{current}</p>
                    <p className="text-xs text-text-muted">{metricDelta(current, previous)}</p>
                    <div className="mt-2 h-2 rounded-full bg-surface-sunken" aria-hidden data-rtl-chart>
                      <div
                        className="h-2 rounded-full bg-accent"
                        style={{ width: `${Math.round((current / peak) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState title={copy.metricsTitle} description={copy.comparison} />
      )}
    </div>
  );
}
