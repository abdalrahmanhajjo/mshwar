"use client";

import * as React from "react";
import { ExperienceCard } from "@/components/browse/experience-card";
import { HubNav } from "@/components/hub/hub-nav";
import { HubPagination } from "@/components/hub/hub-pagination";
import { useHubPage } from "@/components/hub/use-hub-page";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getExperience } from "@/lib/catalog";
import { addFavorite, fetchFavorites, removeFavorite, type FavoriteRecord } from "@/lib/hub";
import { useHubCopy } from "@/lib/hub-copy";
import { useSavedExperiences } from "@/lib/saved-experiences";

export function FavoritesView() {
  const copy = useHubCopy();
  const { slugs, has, toggle } = useSavedExperiences();
  const loader = React.useCallback((page: number) => fetchFavorites(page), []);
  const { page, data, error, pending, load, setData } = useHubPage(loader);
  const synced = React.useRef(false);

  React.useEffect(() => {
    if (synced.current || slugs.length === 0) {
      return;
    }
    synced.current = true;
    void Promise.all(slugs.map((slug) => addFavorite(slug)))
      .then(() => load(1))
      .catch(() => undefined);
  }, [load, slugs]);

  async function onRemove(item: FavoriteRecord) {
    await removeFavorite(item.id);
    if (has(item.listing_slug)) {
      toggle(item.listing_slug);
    }
    await load(page);
    setData((current) =>
      current ? { ...current, items: current.items.filter((row) => row.id !== item.id) } : current,
    );
  }

  return (
    <div className="grid gap-6">
      <HubNav current="/favorites" />
      <header>
        <h1 className="text-4xl font-semibold tracking-tight">{copy.favoritesTitle}</h1>
        <p className="mt-3 text-text-muted">{copy.favoritesBody}</p>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {pending && !data ? <p className="text-sm text-text-muted">{copy.favoritesBody}</p> : null}
      {data && data.items.length === 0 ? (
        <EmptyState
          title={copy.favoritesEmpty}
          description={copy.favoritesEmptyHint}
          action={
            <Button asChild>
              <LocaleLink href="/experiences">{copy.explorePlaces}</LocaleLink>
            </Button>
          }
        />
      ) : null}
      {data && data.items.length > 0 ? (
        <div className="grid gap-6">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((item) => {
              const experience = getExperience(item.listing_slug);
              return (
                <div key={item.id} className="grid gap-2">
                  {experience ? (
                    <ExperienceCard experience={experience} />
                  ) : (
                    <Card>
                      <CardHeader>
                        <CardTitle>{item.listing_slug}</CardTitle>
                      </CardHeader>
                      <CardContent />
                    </Card>
                  )}
                  <Button type="button" variant="outline" size="sm" onClick={() => void onRemove(item)}>
                    {copy.unfavorite}
                  </Button>
                </div>
              );
            })}
          </div>
          <HubPagination page={page} total={data.total} onPage={(next) => void load(next)} />
        </div>
      ) : null}
    </div>
  );
}
