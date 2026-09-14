"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePlannerCopy } from "@/lib/planner-copy";
import { fetchWeatherThresholds, saveWeatherThreshold } from "@/lib/planner";

export function WeatherThresholdsForm() {
  const copy = usePlannerCopy();
  const [rows, setRows] = React.useState<{ key: string; value_numeric: number; applies_to: string; unit: string }[]>(
    [],
  );
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchWeatherThresholds()
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.thresholdsTitle}</CardTitle>
        <CardDescription>{copy.thresholdsHint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {rows.map((row) => (
          <label key={row.key} className="grid gap-1 text-sm">
            {row.key} ({row.applies_to})
            <Input
              type="number"
              value={row.value_numeric}
              onChange={(event) =>
                setRows((current) =>
                  current.map((item) =>
                    item.key === row.key ? { ...item, value_numeric: Number(event.target.value) } : item,
                  ),
                )
              }
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                void saveWeatherThreshold(row.key, row.value_numeric)
                  .then(() => setStatus(copy.thresholdsHint))
                  .catch((error: unknown) => setStatus(error instanceof Error ? error.message : copy.thresholdsHint))
              }
            >
              {row.unit}
            </Button>
          </label>
        ))}
        {status ? <p className="text-sm">{status}</p> : null}
      </CardContent>
    </Card>
  );
}
