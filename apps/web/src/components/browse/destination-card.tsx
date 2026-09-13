import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CatalogImage } from "@/components/browse/catalog-image";
import type { Destination } from "@/lib/catalog";

export function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <Link href={`/destinations/${destination.slug}`} className="group block">
      <article className="relative overflow-hidden rounded-card">
        <div className="aspect-[4/3] md:aspect-[5/4]">
          <CatalogImage src={destination.image} alt={destination.imageAlt} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-brand/80 via-brand/15 to-transparent" />
        <ArrowUpRight className="absolute end-4 top-4 size-5 text-brand-foreground" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-5 text-brand-foreground">
          <p className="text-xs uppercase tracking-wide opacity-80">{destination.region}</p>
          <h3 className="mt-1 text-heading font-semibold tracking-tight">{destination.name}</h3>
          <p className="mt-2 text-sm opacity-90">{destination.tags.join(" · ")}</p>
        </div>
      </article>
    </Link>
  );
}
