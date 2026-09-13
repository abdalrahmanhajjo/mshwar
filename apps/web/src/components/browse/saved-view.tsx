"use client";

import { ExperienceCard } from "@/components/browse/experience-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { getExperience } from "@/lib/catalog";
import { useSavedExperiences } from "@/lib/saved-experiences";
import Link from "next/link";

export function SavedView() {
  const copy = useBrowseCopy();
  const { slugs } = useSavedExperiences();
  const items = slugs
    .map((slug) => getExperience(slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="shell-frame grid gap-8 py-12">
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">{copy.savedTitle}</h1>
        <p className="mt-3 text-text-muted">{copy.myTrips}</p>
      </header>
      {items.length ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((experience) => (
            <ExperienceCard key={experience.slug} experience={experience} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={copy.savedEmpty}
          action={
            <Button asChild>
              <Link href="/experiences">{copy.exploreAll}</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
