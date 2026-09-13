"use client";

import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { useSavedExperiences } from "@/lib/saved-experiences";
import { cn } from "@/lib/utils";

export function SaveExperienceButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const copy = useBrowseCopy();
  const { has, toggle } = useSavedExperiences();
  const saved = has(slug);

  return (
    <Button
      type="button"
      variant={compact ? "secondary" : "outline"}
      size={compact ? "icon" : "sm"}
      aria-pressed={saved}
      aria-label={saved ? copy.savedExperience : copy.saveExperience}
      className={cn(compact && "rounded-full bg-surface/95")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(slug);
      }}
    >
      <Heart className={cn("size-4", saved && "fill-accent text-accent")} aria-hidden />
      {compact ? null : saved ? copy.savedExperience : copy.saveExperience}
    </Button>
  );
}
