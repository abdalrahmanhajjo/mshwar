"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlannerCopy } from "@/lib/planner-copy";
import type { ReplanResult } from "@/lib/planner";

export function ReplanDiff({ result }: { result: ReplanResult | null }) {
  const copy = usePlannerCopy();
  if (!result) {
    return null;
  }
  if (!result.applied) {
    return (
      <p role="status" className="text-sm">
        {result.message || copy.replanNone}
      </p>
    );
  }
  const beforeIds = result.before?.ordered_stops.map((stop) => stop.label).join(" → ") ?? "";
  const afterIds = result.after?.ordered_stops.map((stop) => stop.label).join(" → ") ?? "";
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{copy.before}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">{beforeIds}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.after}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">{afterIds}</CardContent>
      </Card>
    </div>
  );
}
