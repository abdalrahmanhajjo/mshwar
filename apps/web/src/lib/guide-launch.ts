import type { GuideAvailability, GuideTour } from "@/lib/guide-work";
import type { GuideJoinKey } from "@/lib/guide-join-copy";
import type { MyGuideProfile } from "@/lib/guides";

export type LaunchStep = { key: GuideJoinKey; done: boolean; href: string };

/**
 * What a newly approved guide still has to do before a traveller can book them, read from
 * their real profile, tours and weekly times - nothing is ticked on trust.
 */
export function launchSteps(
  profile: MyGuideProfile & { day_rate_minor?: number | null },
  tours: GuideTour[],
  availability: GuideAvailability | null,
): LaunchStep[] {
  const steps: LaunchStep[] = [
    {
      key: "launchProfile",
      done: Boolean(
        profile.headline.trim() && profile.bio.trim() && profile.languages.length && profile.regions.length,
      ),
      href: "#guide-form",
    },
    { key: "launchTour", done: tours.length > 0, href: "/guide/tours" },
    { key: "launchPublish", done: tours.some((tour) => tour.status === "published"), href: "/guide/tours" },
    {
      key: "launchTimes",
      // A weekly rhythm or a schedule on any tour both say when the guide works.
      done:
        Boolean(availability?.pattern.length) ||
        Boolean(availability?.schedules) ||
        tours.some((tour) => (tour.schedules?.length ?? 0) > 0),
      href: "/guide/calendar",
    },
    { key: "launchDates", done: tours.some((tour) => tour.upcoming_slots > 0), href: "/guide/tours" },
  ];
  if (profile.tier === "licensed") {
    steps.push({ key: "launchHire", done: (profile.day_rate_minor ?? 0) > 0, href: "#hire-terms" });
  }
  return steps;
}
