"use client";

import { Heart } from "lucide-react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { getExperience } from "@/lib/catalog";
import { useSavedExperiences } from "@/lib/saved-experiences";
import { LocaleLink } from "@/components/shell/locale-link";

export function SavedView() {
  const copy = useBrowseCopy();
  const { slugs } = useSavedExperiences();
  const items = slugs
    .map((slug) => getExperience(slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="shell-frame grid gap-10 pb-20 pt-12">
      <PageHeader eyebrow={copy.savedKicker} title={copy.savedTitle} description={copy.savedBody} />
      {items.length ? (
        <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((experience) => (
            <ExperienceCard key={experience.slug} experience={experience} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Heart aria-hidden />}
          title={copy.savedEmpty}
          action={
            <Button asChild>
              <LocaleLink href="/experiences">{copy.exploreAll}</LocaleLink>
            </Button>
          }
        />
      )}
    </div>
  );
}
