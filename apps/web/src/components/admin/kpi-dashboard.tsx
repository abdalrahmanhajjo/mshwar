"use client";

import * as React from "react";
import { Activity, AlertTriangle, LifeBuoy } from "lucide-react";
import { AdminHeader } from "@/components/admin/admin-ui";
import { StatCard } from "@/components/ui/stat-card";
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
    <div className="grid gap-8">
      <AdminHeader
        title={copy.kpiTitle}
        description={copy.overviewBody}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-medium text-text-muted">
              {copy.fromLabel}
              <Input
                type="datetime-local"
                aria-label="from"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="min-h-10 py-1.5"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-text-muted">
              {copy.toLabel}
              <Input
                type="datetime-local"
                aria-label="to"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="min-h-10 py-1.5"
              />
            </label>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label={copy.openCases} value={cases} icon={<LifeBuoy aria-hidden />} />
        <StatCard label={copy.openIssues} value={quality} icon={<AlertTriangle aria-hidden />} />
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {definitions.map((item) => (
          <div
            key={item.key}
            className="flex flex-col gap-3 rounded-card border border-border-subtle bg-surface-raised p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <dt className="text-sm font-medium text-text-muted" title={item.definition}>
                {item.label}
              </dt>
              <Activity className="size-4 text-text-muted" aria-hidden />
            </div>
            <dd className="text-[2rem] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {metrics[item.key] ?? 0}
            </dd>
            <p className="text-xs leading-relaxed text-text-muted">
              {copy.metricDefinition}: {item.definition}
            </p>
          </div>
        ))}
      </dl>
    </div>
  );
}
