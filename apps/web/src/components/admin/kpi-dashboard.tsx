"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchKpis, listCases, listQuality } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";
import { Input } from "@/components/ui/input";

export function KpiDashboard() {
  const copy = useAdminCopy();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [metrics, setMetrics] = React.useState<Record<string, number>>({});
  const [definitions, setDefinitions] = React.useState<{ key: string; label: string; definition: string }[]>([]);
  const [cases, setCases] = React.useState(0);
  const [quality, setQuality] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void fetchKpis(from || undefined, to || undefined)
      .then((payload) => {
        if (!cancelled) {
          setMetrics(payload.metrics);
          setDefinitions(payload.definitions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMetrics({});
        }
      });
    void listCases("open")
      .then((rows) => {
        if (!cancelled) {
          setCases(rows.length);
        }
      })
      .catch(() => undefined);
    void listQuality()
      .then((payload) => {
        if (!cancelled) {
          setQuality(payload.issues.filter((item) => item.status === "open").length);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.kpiTitle}</CardTitle>
        <CardDescription>
          Open cases {cases}. Open quality issues {quality}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <Input
            type="datetime-local"
            aria-label="from"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <Input type="datetime-local" aria-label="to" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {definitions.map((item) => (
            <div key={item.key} className="rounded-card border border-border p-3">
              <dt className="text-sm font-medium" title={item.definition}>
                {item.label}
              </dt>
              <dd className="text-title">{metrics[item.key] ?? 0}</dd>
              <p className="text-sm text-text-muted">
                {copy.metricDefinition}: {item.definition}
              </p>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
