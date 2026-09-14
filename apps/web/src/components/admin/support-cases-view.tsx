"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { assignCase, createCase, escalateCase, listCases, resolveCase } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";
import { useAuth } from "@/components/shell/auth-provider";

export function SupportCasesView() {
  const copy = useAdminCopy();
  const { user } = useAuth();
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
    void reload();
  }, [reload]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.casesTitle}</CardTitle>
        <CardDescription>{copy.outcomeRequired}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input aria-label="case reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <Button type="button" onClick={() => void createCase(reason, [{ kind: "note", value: reason }]).then(reload)}>
          Open case
        </Button>
        <Input aria-label="outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} />
        <ul className="grid gap-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm">
              <span>
                {row.status} — {row.reason} ({row.age_hours}h)
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void assignCase(row.id, user?.id ?? "", copy.assign).then(reload)}
                >
                  {copy.assign}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void escalateCase(row.id, "escalated").then(reload)}>
                  Escalate
                </Button>
                <Button type="button" size="sm" disabled={outcome.length < 3} onClick={() => void resolveCase(row.id, outcome).then(reload)}>
                  Resolve
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
