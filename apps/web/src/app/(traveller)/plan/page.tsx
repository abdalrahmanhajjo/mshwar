import { ShellMain } from "@/components/shell/app-shell";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { PlanDefaultsNote } from "@/components/profile/plan-defaults-note";
import { PlannerView } from "@/components/planner/planner-view";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { loadCollection } from "@/lib/catalogue-api";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const collectionSlug = typeof params.collection === "string" ? params.collection : "";
  const tripId = typeof params.trip === "string" ? params.trip : "";
  const addSlug = typeof params.add === "string" ? params.add : "";
  const collection = collectionSlug ? await loadCollection(collectionSlug) : undefined;

  return (
    <ShellMain>
      {collection ? (
        <p className="text-sm text-text-muted">
          Started from “{collection.title}”. {collection.experienceSlugs.length} published stops. Edit from structured
          inventory only.
        </p>
      ) : null}
      {tripId ? <p className="text-sm text-text-muted">Trip {tripId}</p> : null}
      {addSlug ? (
        <Button asChild className="w-full max-w-xl">
          <LocaleLink href={`/checkout?listing=${addSlug}&source=itinerary`}>Book this stop</LocaleLink>
        </Button>
      ) : null}
      <PlannerView initialTripId={tripId || undefined} />
      <PlanDefaultsNote />
      <PlanWorkspace />
    </ShellMain>
  );
}
