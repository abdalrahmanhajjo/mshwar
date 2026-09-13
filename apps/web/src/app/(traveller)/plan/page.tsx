import { ShellMain } from "@/components/shell/app-shell";
import { PlanDefaultsNote } from "@/components/profile/plan-defaults-note";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlanPage() {
  return (
    <ShellMain>
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>Build an itinerary from structured inventory.</CardDescription>
        </CardHeader>
      </Card>
      <PlanDefaultsNote />
    </ShellMain>
  );
}
