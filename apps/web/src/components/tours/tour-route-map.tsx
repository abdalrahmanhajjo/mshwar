"use client";

import { PlanRouteMap, type RouteStop } from "@/components/maps/plan-route-map";
import { usePlannerCopy } from "@/lib/planner-copy";

/** A tour's route on the keyless map, from the meeting point through each stop. */
export function TourRouteMap({ stops, start }: { stops: RouteStop[]; start: { lat: number; lng: number } | null }) {
  const copy = usePlannerCopy();
  return <PlanRouteMap stops={stops} start={start} day={1} copy={copy} />;
}
