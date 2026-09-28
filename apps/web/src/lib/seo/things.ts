import type { ExperienceFilters } from "@/lib/catalog";
import type { SeoKey } from "@/lib/seo-copy";

/**
 * The things-to-do landing pages: one clean, crawlable URL per way of browsing
 * (/things-to-do/nature …), each backed by the same filter the experiences list uses.
 */
export type ThingSlug = "nature" | "coast" | "culture" | "adventure" | "city" | "food";

export const THINGS: { slug: ThingSlug; filter: ExperienceFilters; name: SeoKey; title: SeoKey; intro: SeoKey }[] = [
  {
    slug: "nature",
    filter: { category: "nature" },
    name: "cat_nature_name",
    title: "cat_nature_title",
    intro: "cat_nature_intro",
  },
  {
    slug: "coast",
    filter: { category: "coast" },
    name: "cat_coast_name",
    title: "cat_coast_title",
    intro: "cat_coast_intro",
  },
  {
    slug: "culture",
    filter: { category: "culture" },
    name: "cat_culture_name",
    title: "cat_culture_title",
    intro: "cat_culture_intro",
  },
  {
    slug: "adventure",
    filter: { category: "adventure" },
    name: "cat_adventure_name",
    title: "cat_adventure_title",
    intro: "cat_adventure_intro",
  },
  {
    slug: "city",
    filter: { category: "city" },
    name: "cat_city_name",
    title: "cat_city_title",
    intro: "cat_city_intro",
  },
  {
    slug: "food",
    filter: { kind: "restaurant" },
    name: "cat_food_name",
    title: "cat_food_title",
    intro: "cat_food_intro",
  },
];

export function thingBySlug(slug: string) {
  return THINGS.find((item) => item.slug === slug);
}

/** The full, filterable list behind a landing page. */
export function thingListHref(slug: ThingSlug): string {
  return slug === "food" ? "/experiences?kind=restaurant" : `/experiences?category=${slug}`;
}
