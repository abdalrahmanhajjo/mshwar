import type { Destination, ExperienceCategory, ExperienceFilters } from "@/lib/catalog";
import { useHomeCopy, type HomeKey } from "@/lib/home-copy";

export type Mood = ExperienceCategory | "food";

/** The ways a traveller can browse. Food is a listing kind, the rest are categories. */
export const MOODS: {
  slug: Mood;
  label: HomeKey;
  line: HomeKey;
  filter: ExperienceFilters;
  /** Destinations whose cover photo reads as this mood, best first. */
  photoFrom: string[];
}[] = [
  {
    slug: "nature",
    label: "moodNature",
    line: "moodNatureLine",
    filter: { category: "nature" },
    photoFrom: ["bsharri", "north-lebanon", "qadisha-valley"],
  },
  {
    slug: "coast",
    label: "moodCoast",
    line: "moodCoastLine",
    filter: { category: "coast" },
    photoFrom: ["batroun", "byblos", "south-lebanon"],
  },
  {
    slug: "culture",
    label: "moodCulture",
    line: "moodCultureLine",
    filter: { category: "culture" },
    photoFrom: ["byblos", "baalbek-hermel", "beqaa"],
  },
  {
    slug: "adventure",
    label: "moodAdventure",
    line: "moodAdventureLine",
    filter: { category: "adventure" },
    photoFrom: ["qadisha-valley", "akkar", "mount-lebanon"],
  },
  { slug: "city", label: "moodCity", line: "moodCityLine", filter: { category: "city" }, photoFrom: ["beirut"] },
  {
    slug: "food",
    label: "moodFood",
    line: "moodFoodLine",
    filter: { kind: "restaurant" },
    photoFrom: ["nabatieh", "south-lebanon", "batroun"],
  },
];

/** The categories the search's "experience" field offers (food is a kind, not a category). */
export const MOOD_CATEGORIES: ExperienceCategory[] = ["nature", "coast", "culture", "adventure", "city"];

export function useMoodLabel() {
  const copy = useHomeCopy();
  return (slug: Mood) => copy[MOODS.find((mood) => mood.slug === slug)?.label ?? "moodAll"];
}

/** A real destination photo for a mood; any destination photo as a last resort. */
export function moodPhoto(
  mood: (typeof MOODS)[number],
  destinations: Destination[],
  used: Set<string>,
): Destination | undefined {
  const withImage = destinations.filter((item) => item.image);
  const pick =
    mood.photoFrom.map((slug) => withImage.find((item) => item.slug === slug && !used.has(item.image))).find(Boolean) ??
    withImage.find((item) => !used.has(item.image));
  if (pick) {
    used.add(pick.image);
  }
  return pick;
}
