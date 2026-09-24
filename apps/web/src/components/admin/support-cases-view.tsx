"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Plus } from "lucide-react";
import { AdminHeader, EmptyRow, TableShell } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { statusTone } from "@/lib/status";
import { Input } from "@/components/ui/input";
import { assignCase, createCase, escalateCase, listCases, resolveCase } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";
import { useAuth } from "@/components/shell/auth-provider";
import { upholdExchangeReport } from "@/lib/exchange";
import { useAdminTrustCopy } from "@/lib/admin-trust-copy";

export function SupportCasesView() {
  const copy = useAdminCopy();
  const trust = useAdminTrustCopy();
  const { user } = useAuth();
  const [upheld, setUpheld] = React.useState<Record<string, string>>({});

  async function uphold(id: string) {
    try {
      const result = await upholdExchangeReport(id);
      setUpheld((current) => ({ ...current, [id]: result.rates_paused ? trust.ratesPausedNow : trust.upheld }));
    } catch (caught) {
      setUpheld((current) => ({ ...current, [id]: caught instanceof Error ? caught.message : trust.loadError }));
    }
  }
  const [reason, setReason] = React.useState("Reported listing");
  const [outcome, setOutcome] = React.useState("");
  const [rows, setRows] = React.useState<{ id: string; status: string; reason: string; age_hours: number }[]>([]);

  const reload = React.useCallback(async () => {
    try {
      setRows(await listCases());
    } catch {
      setRows([]);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void listCases()
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
  }, []);

  return (
    <div className="grid gap-8">
      <AdminHeader title={copy.casesTitle} description={copy.outcomeRequired} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5">
          <Label htmlFor="case-reason">{copy.caseReasonLabel}</Label>
          <div className="flex gap-2">
            <Input
              id="case-reason"
              aria-label="case reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Button
              type="button"
              onClick={() => void createCase(reason, [{ kind: "note", value: reason }]).then(reload)}
            >
              <Plus aria-hidden />
              {copy.openCase}
            </Button>
          </div>
        </div>
        <div className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5">
          <Label htmlFor="case-outcome">{copy.outcomeLabel}</Label>
          <Input
            id="case-outcome"
            aria-label="outcome"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
          />
        </div>
      </div>
      <TableShell>
        <thead>
          <tr>
            <th scope="col">{copy.statusCol}</th>
            <th scope="col">{copy.caseReasonLabel}</th>
            <th scope="col">SLA</th>
            <th scope="col">{copy.actionsCol}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <EmptyRow colSpan={4} label={copy.queueEmpty} /> : null}
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Badge variant={statusTone(row.status)}>{row.status}</Badge>
              </td>
              <td className="font-medium">{row.reason}</td>
              <td className="tabular-nums text-text-muted">{row.age_hours}h</td>
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void assignCase(row.id, user?.id ?? "", copy.assign).then(reload)}
                  >
                    {copy.assign}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => void escalateCase(row.id, "escalated").then(reload)}
                  >
                    {copy.escalate}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={outcome.length < 3}
                    onClick={() => void resolveCase(row.id, outcome).then(reload)}
                  >
                    <Check aria-hidden />
                    {copy.resolve}
                  </Button>
                  {row.reason.startsWith("exchange_") ? (
                    upheld[row.id] ? (
                      <span className="text-sm text-text-muted">{upheld[row.id]}</span>
                    ) : (
                      <Button type="button" size="sm" variant="outline" onClick={() => void uphold(row.id)}>
                        {trust.upholdExchange}
                      </Button>
                    )
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
