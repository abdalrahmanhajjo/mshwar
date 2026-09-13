"use client";

import { useRouter } from "next/navigation";
import { ExperienceCard } from "@/components/browse/experience-card";
import { LocaleLink } from "@/components/shell/locale-link";
import { useAuth } from "@/components/shell/auth-provider";
import { Button } from "@/components/ui/button";
import { useBrowseCopy } from "@/lib/browse-copy";
import { withLocalePrefix } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";
import type { Experience, Idea } from "@/lib/catalog";

export function CollectionDetailView({ collection, stops }: { collection: Idea; stops: Experience[] }) {
  const copy = useBrowseCopy();
  const { user } = useAuth();
  const { locale } = useLocale();
  const router = useRouter();

  async function openAsTrip() {
    if (!user) {
      router.push(withLocalePrefix(locale, `/signin?next=/collections/${collection.slug}`));
      return;
    }
    const response = await fetch(`/api/v1/catalogue/collections/${collection.slug}/open-as-trip`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      return;
    }
    const trip = (await response.json()) as { id: string };
    router.push(withLocalePrefix(locale, `/plan?trip=${trip.id}&collection=${collection.slug}`));
  }

  return (
    <div className="shell-frame grid gap-10 py-12 md:py-16">
      <LocaleLink href="/collections" className="text-sm text-text-muted">
        {copy.collectionsTitle}
      </LocaleLink>
      <header className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.16em] text-text-muted">{collection.kicker}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">{collection.title}</h1>
        <p className="mt-4 text-text-muted">{collection.description}</p>
        <div className="mt-6">
          <Button type="button" className="rounded-pill" onClick={() => void openAsTrip()}>
            {copy.openAsTrip}
          </Button>
        </div>
      </header>
      <div className="grid gap-8 md:grid-cols-2">
        {stops.map((experience) => (
          <ExperienceCard key={experience.slug} experience={experience} />
        ))}
      </div>
    </div>
  );
}
