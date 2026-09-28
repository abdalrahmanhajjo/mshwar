"use client";

import {
  DestinationMosaic,
  EditorialMoment,
  HomeHero,
  MobilePlanBar,
  MoodGrid,
  PlannerShowcase,
  StayInspired,
  TravellerStories,
  WhyMshwar,
} from "@/components/home/home-sections";
import { HomeMap } from "@/components/home/home-map";
import { DESTINATIONS, EXPERIENCES, HOME_HERO_IMAGE } from "@/lib/catalog";
import type { Destination, Experience } from "@/lib/catalog";
import type { TravellerStory } from "@/lib/catalogue-api";

/**
 * The traveller homepage, in the order a first visit needs it: what this is and
 * where to start (hero + search), why to trust it, then ways in — by mood, by
 * map, by planning, by place — and one human moment before the sign-off.
 */
export function HomeView({
  experiences = EXPERIENCES,
  destinations = DESTINATIONS,
  heroImage = HOME_HERO_IMAGE,
  stories = [],
}: {
  experiences?: Experience[];
  destinations?: Destination[];
  heroImage?: string;
  /** Published reviews of verified bookings only; none means the section is left out. */
  stories?: TravellerStory[];
} = {}) {
  return (
    <div className="pb-24 md:pb-8">
      <HomeHero image={heroImage} destinations={destinations} />
      <WhyMshwar />
      <div className="grid gap-16 pt-14 md:gap-24 md:pt-20 lg:gap-28">
        <MoodGrid destinations={destinations} />
        <HomeMap experiences={experiences} />
        <PlannerShowcase />
        <DestinationMosaic destinations={destinations} />
        <EditorialMoment destinations={destinations} />
        <TravellerStories stories={stories} />
        <StayInspired />
      </div>
      <MobilePlanBar />
    </div>
  );
}
