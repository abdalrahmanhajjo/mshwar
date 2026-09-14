"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.qualityTitle}</CardTitle>
        <CardDescription>{scheduler}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button type="button" onClick={() => void runQuality(true).then(reload)}>
          {copy.runChecks}
        </Button>
        <ul className="grid gap-2 text-sm">
          {issues.map((issue) => (
            <li key={issue.id} className="flex items-center justify-between gap-2 border-b border-border py-2">
              <span>
                {issue.rule_code} — {issue.status}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void notifyQuality(issue.id).then(reload)}
              >
                {copy.notifyBusiness}
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
