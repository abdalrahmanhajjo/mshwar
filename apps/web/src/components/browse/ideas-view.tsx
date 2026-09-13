"use client";

import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Idea } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function IdeasView({ ideas }: { ideas: Idea[] }) {
  const copy = useBrowseCopy();
  return (
    <div className="shell-frame grid gap-12 py-12 md:py-16">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{copy.ideasEyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{copy.ideasTitle}</h1>
        <p className="mt-4 text-text-muted">{copy.ideasBody}</p>
      </header>
      <div className="grid gap-10">
        {ideas.map((idea, index) => {
          const flip = index % 2 === 1;
          return (
            <article
              key={idea.slug}
              className={cn("grid items-center gap-6 lg:grid-cols-2", flip && "lg:[&>*:first-child]:order-2")}
            >
              <div className={cn("overflow-hidden rounded-card", flip ? "lg:order-2" : undefined)}>
                <div className="aspect-[16/9]">
                  <CatalogImage src={idea.image} alt={idea.imageAlt} />
                </div>
              </div>
              <div className={cn("grid gap-4", flip ? "lg:order-1" : undefined)}>
                <p className="text-xs uppercase tracking-[0.16em] text-text-muted">{idea.kicker}</p>
                <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{idea.title}</h2>
                <p className="text-text-muted">{idea.description}</p>
                <p className="text-sm text-text-muted">
                  {copy.fromPrice} ${idea.priceFrom} {copy.perPerson} · {copy.preview}
                </p>
                <Progress value={(idea.stops / 3) * 100} label={`${idea.stops} / 3`} />
                <div>
                  <Button asChild className={cn("rounded-pill", idea.accent && "bg-accent text-accent-foreground")}>
                    <LocaleLink href={`/collections/${idea.slug}`}>{copy.exploreDay}</LocaleLink>
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
