"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlannerCopy } from "@/lib/planner-copy";
import type { WarningResult } from "@/lib/planner";

export function WeatherWarningList({ result }: { result: WarningResult | null }) {
  const copy = usePlannerCopy();
  if (!result) {
    return null;
  }
  if (result.forecast_unavailable && result.warnings.length === 0) {
    return <p className="text-sm text-text-muted">{copy.forecastUnavailable}</p>;
  }
  if (result.warnings.length === 0) {
    return <p className="text-sm text-text-muted">{copy.noWarning}</p>;
  }
  return (
    <div className="grid gap-3">
      {result.warnings.map((warning) => (
        <Card key={warning.stop_id}>
          <CardHeader>
            <CardTitle>{copy.weatherWarning}</CardTitle>
            <CardDescription>
              {warning.stop_label} · {warning.source} · {warning.fetched_at ?? warning.forecast_date}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {warning.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
