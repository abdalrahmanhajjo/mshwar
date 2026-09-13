"use client";

import { CatalogImage } from "@/components/browse/catalog-image";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Idea } from "@/lib/catalog";

export function CollectionsView({ collections }: { collections: Idea[] }) {
  const copy = useBrowseCopy();
  return (
    <div className="shell-frame grid gap-12 py-12 md:py-16">
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{copy.collectionsEyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{copy.collectionsTitle}</h1>
        <p className="mt-4 text-text-muted">{copy.collectionsBody}</p>
      </header>
      <div className="grid gap-8 md:grid-cols-2">
        {collections.map((collection) => (
          <article key={collection.slug} className="grid gap-4">
            <div className="overflow-hidden rounded-card">
              <div className="aspect-[16/9]">
                <CatalogImage src={collection.image} alt={collection.imageAlt} />
              </div>
            </div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">{collection.kicker}</p>
            <h2 className="text-2xl font-semibold tracking-tight">{collection.title}</h2>
            <p className="text-text-muted">{collection.description}</p>
            <Button asChild className="w-fit rounded-pill">
              <LocaleLink href={`/collections/${collection.slug}`}>{copy.exploreDay}</LocaleLink>
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
