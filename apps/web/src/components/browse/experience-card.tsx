"use client";

import { LocaleLink } from "@/components/shell/locale-link";
import { Clock, MapPin } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import { SaveExperienceButton } from "@/components/browse/save-button";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Experience } from "@/lib/catalog";
import { CATEGORIES } from "@/lib/catalog";

export function ExperienceCard({ experience, compact = false }: { experience: Experience; compact?: boolean }) {
  const copy = useBrowseCopy();
  const category = CATEGORIES.find((item) => item.slug === experience.category)?.label ?? experience.category;

  return (
    <article className="group relative flex h-full flex-col">
      <span className="absolute end-3 top-3 z-10">
        <SaveExperienceButton slug={experience.slug} compact />
      </span>
      <LocaleLink href={`/experiences/${experience.slug}`} className="flex h-full flex-col">
        <div className="relative overflow-hidden rounded-card">
          <div className={compact ? "aspect-[5/4]" : "aspect-[4/3]"}>
            <CatalogImage src={experience.image} alt={experience.imageAlt} />
          </div>
          <span className="absolute start-3 top-3 rounded-pill bg-surface/95 px-2.5 py-1 text-xs font-medium text-text">
            {category}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 pt-3">
          <p className="text-xs text-text-muted">
            <MapPin className="me-1 inline size-3" aria-hidden />
            {experience.placeLabel}
          </p>
          <h3 className="text-title font-semibold tracking-tight text-text group-hover:underline">
            {experience.title}
          </h3>
          <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-sm text-text-muted">
            <span>
              <Clock className="me-1 inline size-3.5" aria-hidden />
              {experience.hours} {copy.hoursLabel}
            </span>
            <span className="font-medium text-text">
              {copy.fromPrice} ${experience.priceFrom}
            </span>
          </div>
        </div>
      </LocaleLink>
    </article>
  );
}
