import { ShellMain } from "@/components/shell/app-shell";
import { PlanDefaultsNote } from "@/components/profile/plan-defaults-note";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadCollection } from "@/lib/catalogue-api";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const collectionSlug = typeof params.collection === "string" ? params.collection : "";
  const tripId = typeof params.trip === "string" ? params.trip : "";
  const collection = collectionSlug ? await loadCollection(collectionSlug) : undefined;

  return (
    <ShellMain>
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>
            {collection
              ? `Started from “${collection.title}”. ${collection.experienceSlugs.length} published stops. Edit from structured inventory only.`
              : "Build an itinerary from structured inventory."}
          </CardDescription>
        </CardHeader>
      </Card>
      {tripId ? <p className="text-sm text-text-muted">Trip {tripId}</p> : null}
      <PlanDefaultsNote />
    </ShellMain>
  );
}
