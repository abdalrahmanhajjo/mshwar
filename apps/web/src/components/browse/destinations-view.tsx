"use client";

import { DestinationCard } from "@/components/browse/destination-card";
import { useBrowseCopy } from "@/lib/browse-copy";
import type { Destination } from "@/lib/catalog";

export function DestinationsView({ destinations }: { destinations: Destination[] }) {
  const copy = useBrowseCopy();
  return (
    <div className="shell-frame grid gap-10 py-12 md:py-16">
      <header className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-text-muted">{copy.destinationsEyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">{copy.destinationsTitle}</h1>
        <p className="mt-4 text-text-muted">{copy.destinationsBody}</p>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {destinations.map((destination) => (
          <DestinationCard key={destination.slug} destination={destination} />
        ))}
      </div>
      <p className="rounded-pill bg-surface-sunken px-5 py-4 text-center text-sm text-text-muted">
        {copy.destinationsNote}
      </p>
    </div>
  );
}
