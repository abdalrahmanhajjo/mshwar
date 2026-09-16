"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Play, Send } from "lucide-react";
import { AdminHeader, EmptyRow, TableShell } from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { statusTone } from "@/lib/status";
import { listQuality, notifyQuality, runQuality } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";

export function DataQualityView() {
  const copy = useAdminCopy();
  const [issues, setIssues] = React.useState<{ id: string; rule_code: string; status: string }[]>([]);
  const [scheduler, setScheduler] = React.useState("");

  const reload = React.useCallback(async () => {
    try {
      const payload = await listQuality();
      setIssues(payload.issues);
      setScheduler(payload.scheduler.trigger);
    } catch {
      setIssues([]);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void listQuality()
      .then((payload) => {
        if (!cancelled) {
          setIssues(payload.issues);
          setScheduler(payload.scheduler.trigger);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIssues([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <AdminHeader
        title={copy.qualityTitle}
        description={scheduler ? `${copy.runs}: ${scheduler}` : undefined}
        actions={
          <Button type="button" onClick={() => void runQuality(true).then(reload)}>
            <Play aria-hidden />
            {copy.runChecks}
          </Button>
        }
      />
      <TableShell>
        <thead>
          <tr>
            <th scope="col">{copy.nameCol}</th>
            <th scope="col">{copy.statusCol}</th>
            <th scope="col">{copy.actionsCol}</th>
          </tr>
        </thead>
        <tbody>
          {issues.length === 0 ? <EmptyRow colSpan={3} label={copy.queueEmpty} /> : null}
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td className="font-mono text-xs">{issue.rule_code}</td>
              <td>
                <Badge variant={statusTone(issue.status === "open" ? "warning" : issue.status)}>{issue.status}</Badge>
              </td>
              <td>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void notifyQuality(issue.id).then(reload)}
                >
                  <Send aria-hidden />
                  {copy.notifyBusiness}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
