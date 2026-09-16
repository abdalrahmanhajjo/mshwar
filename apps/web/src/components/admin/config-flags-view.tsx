"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Save, ShieldCheck, Undo2 } from "lucide-react";
import { ReasonField } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { listConfig, listFlags, putConfig, putFlag, rollbackConfig } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";

export function ConfigFlagsView() {
  const copy = useAdminCopy();
  const [reason, setReason] = React.useState("Live-safe marketplace update");
  const [bps, setBps] = React.useState("1000");
  const [fee, setFee] = React.useState("0");
  const [flagKey, setFlagKey] = React.useState("planner.v2");
  const [environment, setEnvironment] = React.useState("development");
  const [cohort, setCohort] = React.useState("all");
  const [enabled, setEnabled] = React.useState(false);
  const [config, setConfig] = React.useState<{ key: string; version: number }[]>([]);
  const [flags, setFlags] = React.useState<{ key: string; environment: string; cohort: string; enabled: boolean }[]>(
    [],
  );

  const reload = React.useCallback(async () => {
    try {
      setConfig(await listConfig());
      setFlags(await listFlags());
    } catch {
      setConfig([]);
      setFlags([]);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([listConfig(), listFlags()])
      .then(([nextConfig, nextFlags]) => {
        if (!cancelled) {
          setConfig(nextConfig);
          setFlags(nextFlags);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfig([]);
          setFlags([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <Notice icon={<ShieldCheck aria-hidden />}>{copy.feesNote}</Notice>
      <ReasonField id="config-reason" value={reason} onChange={setReason} className="max-w-xl" />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.fees}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-label font-medium">
                {copy.commissionLabel}
                <Input
                  aria-label="commission bps"
                  inputMode="numeric"
                  value={bps}
                  onChange={(event) => setBps(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-label font-medium">
                {copy.serviceFeeLabel}
                <Input
                  aria-label="service fee"
                  inputMode="numeric"
                  value={fee}
                  onChange={(event) => setFee(event.target.value)}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  void putConfig(
                    "marketplace.fees",
                    { commission_bps: Number(bps), service_fee_minor: Number(fee), currency: "USD" },
                    reason,
                  ).then(reload)
                }
              >
                <Save aria-hidden />
                {copy.saveFees}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void rollbackConfig("marketplace.fees", reason).then(reload)}
              >
                <Undo2 aria-hidden />
                {copy.rollback}
              </Button>
            </div>
            <div className="grid gap-2 border-t border-border-subtle pt-4">
              <h3 className="text-sm font-semibold">{copy.configVersions}</h3>
              <ul className="flex flex-wrap gap-2 text-sm">
                {config.map((row) => (
                  <li key={`${row.key}-${row.version}`}>
                    <Badge variant="outline">
                      {row.key} · v{row.version}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.flags}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-label font-medium">
                {copy.flagKeyLabel}
                <Input aria-label="flag key" value={flagKey} onChange={(event) => setFlagKey(event.target.value)} />
              </label>
              <label className="grid gap-2 text-label font-medium">
                {copy.environmentLabel}
                <Input
                  aria-label="environment"
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-label font-medium">
                {copy.cohortLabel}
                <Input aria-label="cohort" value={cohort} onChange={(event) => setCohort(event.target.value)} />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                {copy.enabledLabel}
              </label>
              <Button
                type="button"
                onClick={() => void putFlag({ key: flagKey, environment, cohort, enabled, reason }).then(reload)}
              >
                <Save aria-hidden />
                {copy.saveFlag}
              </Button>
            </div>
            <ul className="grid gap-1.5 border-t border-border-subtle pt-4 text-sm">
              {flags.map((row) => (
                <li
                  key={`${row.key}-${row.environment}-${row.cohort}`}
                  className="flex items-center justify-between gap-3 rounded-control bg-surface-sunken px-3.5 py-2.5"
                >
                  <span className="grid">
                    <span className="font-mono text-xs">{row.key}</span>
                    <span className="text-xs text-text-muted">
                      {row.environment} / {row.cohort}
                    </span>
                  </span>
                  <Badge variant={row.enabled ? "success" : "outline"}>
                    {row.enabled ? copy.enabledLabel : copy.disabledLabel}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
