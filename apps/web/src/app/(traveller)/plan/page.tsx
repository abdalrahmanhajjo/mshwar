import { PlanView } from "@/components/browse/plan-view";
import { PlanWorkspace } from "@/components/plan/plan-workspace";
import { PlannerView } from "@/components/planner/planner-view";
import { ShellMain } from "@/components/shell/app-shell";
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
      <PlanView
        collectionTitle={collection?.title}
        stopCount={collection?.experienceSlugs.length ?? 0}
        tripId={tripId || undefined}
        addSlug={addSlug || undefined}
      />
      <PlannerView initialTripId={tripId || undefined} />
      <PlanWorkspace />
    </ShellMain>
  );
}
