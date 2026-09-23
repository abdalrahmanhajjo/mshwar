import { apiRequest } from "@/lib/api/client";

/** A catalogue place as a picker needs it: a name to show, a handle to send. */
export type PlaceHit = {
  slug: string;
  title: string;
  placeLabel: string;
  destinationSlug: string;
  lat: number | null;
  lng: number | null;
  image: string | null;
};

export type DestinationOption = { slug: string; name: string; region: string; lat: number | null; lng: number | null };

type ApiListing = {
  slug: string;
  title: string;
  place_label: string;
  destination_slug: string;
  lat: number | null;
  lng: number | null;
  image: string | null;
};

/** Search published places by name (the catalogue's own search, so it matches what travellers see). */
export async function searchPlaces(query: string, limit = 8, signal?: AbortSignal): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }
  const params = new URLSearchParams({ q, pageSize: String(limit) });
  const page = await apiRequest<{ items: ApiListing[] }>(`/api/v1/catalogue/experiences?${params.toString()}`, {
    signal,
  });
  return page.items.map((item) => ({
    slug: item.slug,
    title: item.title,
    placeLabel: item.place_label,
    destinationSlug: item.destination_slug,
    lat: item.lat,
    lng: item.lng,
    image: item.image,
  }));
}

let destinations: Promise<DestinationOption[]> | null = null;

/** Every destination, fetched once per page load and shared by every picker. */
export function loadDestinationOptions(): Promise<DestinationOption[]> {
  destinations ??= apiRequest<{ slug: string; name: string; region: string; lat: number | null; lng: number | null }[]>(
    "/api/v1/catalogue/destinations",
  )
    .then((rows) =>
      rows
        .map((row) => ({ slug: row.slug, name: row.name, region: row.region, lat: row.lat, lng: row.lng }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    .catch((error: unknown) => {
      destinations = null;
      throw error;
    });
  return destinations;
}

/** Test seam: forget the cached list. */
export function resetDestinationCache(): void {
  destinations = null;
}

/** Inside Lebanon's bounding box, the same bounds the API checks. */
export function inLebanon(lat: number, lng: number): boolean {
  return lat >= 33.0 && lat <= 34.8 && lng >= 35.0 && lng <= 36.7;
}

/** Common languages first, then whatever the guide has already chosen. */
export const COMMON_LANGUAGES = ["ar", "en", "fr", "es", "it", "de", "hy", "ru", "tr", "pt"] as const;

export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Case- and accent-insensitive text match used by every name search box. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const normalise = (value: string) => value.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = normalise(query).split(/\s+/).filter(Boolean);
  if (!words.length) {
    return true;
  }
  const haystack = normalise(fields.filter(Boolean).join(" "));
  return words.every((word) => haystack.includes(word));
}
