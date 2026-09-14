"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [flags, setFlags] = React.useState<{ key: string; environment: string; cohort: string; enabled: boolean }[]>([]);

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
    void reload();
  }, [reload]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.fees}</CardTitle>
        <CardDescription>
          Live-safe keys: marketplace.fees and feature flags. Actor, timestamp and previous value are versioned.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input aria-label="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <div className="flex flex-wrap gap-2">
          <Input aria-label="commission bps" value={bps} onChange={(event) => setBps(event.target.value)} />
          <Input aria-label="service fee" value={fee} onChange={(event) => setFee(event.target.value)} />
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
            Save fees
          </Button>
          <Button type="button" variant="outline" onClick={() => void rollbackConfig("marketplace.fees", reason).then(reload)}>
            {copy.rollback}
          </Button>
        </div>
        <h3 className="text-sm font-semibold">{copy.flags}</h3>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="flag key" value={flagKey} onChange={(event) => setFlagKey(event.target.value)} />
          <Input aria-label="environment" value={environment} onChange={(event) => setEnvironment(event.target.value)} />
          <Input aria-label="cohort" value={cohort} onChange={(event) => setCohort(event.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            enabled
          </label>
          <Button
            type="button"
            onClick={() => void putFlag({ key: flagKey, environment, cohort, enabled, reason }).then(reload)}
          >
            Save flag
          </Button>
        </div>
        <ul className="text-sm">
          {config.map((row) => (
            <li key={`${row.key}-${row.version}`}>
              {row.key} v{row.version}
            </li>
          ))}
          {flags.map((row) => (
            <li key={`${row.key}-${row.environment}-${row.cohort}`}>
              {row.key} {row.environment}/{row.cohort} {row.enabled ? "on" : "off"}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
