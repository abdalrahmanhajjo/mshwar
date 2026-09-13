"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, Compass, Waves, Trees, Landmark, Mountain } from "lucide-react";
import { useBrowseCopy } from "@/lib/browse-copy";
import { CATEGORIES, parseExperienceFilters, serializeExperienceFilters, type ExperienceCategory } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const ICONS = {
  all: Compass,
  nature: Trees,
  coast: Waves,
  culture: Landmark,
  adventure: Mountain,
  city: Building2,
} as const;

export function CategoryPills({ active, variant = "chips" }: { active?: string; variant?: "chips" | "icons" }) {
  const copy = useBrowseCopy();
  const params = useSearchParams();

  function hrefFor(slug: string) {
    const next = parseExperienceFilters(params);
    next.category = slug === "all" ? undefined : slug;
    next.page = 1;
    const query = serializeExperienceFilters(next);
    return query ? `/experiences?${query}` : "/experiences";
  }

  if (variant === "icons") {
    return (
      <ul className="flex flex-wrap justify-center gap-6 md:gap-10">
        {CATEGORIES.map((item) => {
          const Icon = ICONS[item.slug];
          return (
            <li key={item.slug}>
              <Link href={hrefFor(item.slug)} className="flex flex-col items-center gap-3 text-sm text-text">
                <span className="grid size-16 place-items-center rounded-full bg-surface-raised shadow-sm">
                  <Icon className="size-6" aria-hidden />
                </span>
                {item.slug === "all" ? copy.experiences : item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map((item) => {
        const Icon = ICONS[item.slug];
        const href = hrefFor(item.slug);
        const isActive = (active ?? "all") === item.slug;
        return (
          <Link
            key={item.slug}
            href={href}
            className={cn(
              "inline-flex min-h-[var(--layout-min-target)] items-center gap-2 rounded-pill border px-4 text-sm",
              isActive ? "border-brand bg-brand text-brand-foreground" : "border-border bg-surface-raised text-text",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {item.slug === "all" ? copy.experiences : item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function categoryLabel(slug: "all" | ExperienceCategory): string {
  return CATEGORIES.find((item) => item.slug === slug)?.label ?? slug;
}
