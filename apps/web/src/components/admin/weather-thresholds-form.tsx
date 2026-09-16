"use client";

import * as React from "react";
import { CloudRain, Save } from "lucide-react";
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
        <CardTitle as="h2" className="inline-flex items-center gap-2">
          <CloudRain className="size-5" aria-hidden />
          {copy.thresholdsTitle}
        </CardTitle>
        <CardDescription>{copy.thresholdsHint}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-3 rounded-control border border-border-subtle p-4">
            <label className="grid gap-2 text-sm font-medium">
              <span>
                <span className="font-mono text-xs">{row.key}</span>
                <span className="block text-xs font-normal text-text-muted">{row.applies_to}</span>
              </span>
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
            </label>
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
              <Save aria-hidden />
              {row.unit}
            </Button>
          </div>
        ))}
        {status ? (
          <p role="status" className="text-sm text-text-muted sm:col-span-2 xl:col-span-3">
            {status}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
