import {
  DESTINATIONS,
  EXPERIENCES,
  IDEAS,
  browseExperiences,
  getDestination,
  getExperience,
  relatedExperiences as seedRelated,
  type Destination,
  type Experience,
  type ExperienceFilters,
  type ExperiencePage,
  type Idea,
} from "@/lib/catalog";

const API_ROOT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type ApiPrice = {
  currency: string;
  type: string;
  source: string;
  amount: number;
};

type ApiListing = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  body: string;
  category: string;
  tags: string[];
  destination_slug: string;
  place_label: string;
  hours: number;
  booking_mode: "instant" | "request" | "inquiry";
  kind: "experience" | "attraction" | "restaurant";
  available: boolean;
  weather_sensitivity?: string;
  group_min?: number;
  group_max?: number;
  facts?: { title: string; body: string }[];
  rating?: number | null;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
  travel_seconds?: number | null;
  image?: string | null;
  image_alt?: string | null;
  gallery?: string[];
  price: ApiPrice;
};

type ApiDestination = {
  slug: string;
  name: string;
  region: string;
  country?: string;
  blurb: string;
  image?: string | null;
  image_alt?: string | null;
  tags: string[];
};

type ApiCollection = {
  slug: string;
  title: string;
  description: string;
  kicker: string;
  image?: string | null;
  image_alt?: string | null;
  accent?: boolean;
  stops: number;
  experience_slugs: string[];
  price_from: number;
};

export type SearchRelaxation = { drop: string; label: string };

function priceLabel(type: string): Experience["priceLabel"] {
  if (type === "estimated") {
    return "estimated";
  }
  if (type === "quote-required") {
    return "quote";
  }
  return "from";
}

export function listingFromApi(item: ApiListing): Experience {
  return {
    slug: item.slug,
    title: item.title,
    category: item.category as Experience["category"],
    destinationSlug: item.destination_slug,
    placeLabel: item.place_label,
    hours: item.hours,
    priceFrom: item.price?.amount ?? 0,
    image: item.image ?? "",
    imageAlt: item.image_alt ?? item.title,
    summary: item.summary ?? item.body,
    body: item.body,
    tags: item.tags ?? [],
    bookingMode: item.booking_mode,
    priceLabel: priceLabel(item.price?.type ?? "from"),
    facts: item.facts ?? [],
    kind: item.kind,
    distanceKm: item.distance_km ?? undefined,
    travelSeconds: item.travel_seconds ?? undefined,
    rating: item.rating ?? null,
    groupMin: item.group_min,
    groupMax: item.group_max,
    available: item.available,
    gallery: item.gallery,
  };
}

function destinationFromApi(item: ApiDestination): Destination {
  return {
    slug: item.slug,
    name: item.name,
    region: item.region,
    country: item.country ?? "Lebanon",
    blurb: item.blurb,
    tags: item.tags ?? [],
    image: item.image ?? "",
    imageAlt: item.image_alt ?? item.name,
  };
}

function ideaFromApi(item: ApiCollection): Idea {
  return {
    slug: item.slug,
    kicker: item.kicker,
    title: item.title,
    description: item.description,
    stops: item.stops,
    priceFrom: item.price_from,
    image: item.image ?? "",
    imageAlt: item.image_alt ?? item.title,
    accent: item.accent,
    experienceSlugs: item.experience_slugs,
  };
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_ROOT}${path}`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loadDestinations(): Promise<Destination[]> {
  const rows = await readJson<ApiDestination[]>("/api/v1/catalogue/destinations");
  if (!rows?.length) {
    return DESTINATIONS;
  }
  return rows.map(destinationFromApi);
}

export async function loadDestination(slug: string): Promise<Destination | undefined> {
  const destinations = await loadDestinations();
  return destinations.find((item) => item.slug === slug) ?? getDestination(slug);
}

export async function loadExperiencePage(filters: ExperienceFilters): Promise<ExperiencePage> {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.category && filters.category !== "all") search.set("category", filters.category);
  if (filters.destination) search.set("destination", filters.destination);
  if (filters.kind && filters.kind !== "all") search.set("kind", filters.kind);
  if (filters.sort) search.set("sort", filters.sort);
  if (filters.priceMax) search.set("priceMax", String(filters.priceMax));
  if (filters.party) search.set("party", String(filters.party));
  if (filters.available) search.set("available", "true");
  search.set("page", String(filters.page ?? 1));
  search.set("pageSize", String(filters.pageSize ?? 6));
  const page = await readJson<ExperiencePage & { items: ApiListing[] }>(`/api/v1/catalogue/experiences?${search}`);
  if (!page) {
    return browseExperiences(filters);
  }
  return {
    ...page,
    items: page.items.map(listingFromApi),
  };
}

export async function loadExperience(slug: string): Promise<Experience | undefined> {
  const item = await readJson<ApiListing>(`/api/v1/catalogue/experiences/${slug}`);
  if (!item) {
    return getExperience(slug);
  }
  return listingFromApi(item);
}

export async function loadRelated(slug: string): Promise<Experience[]> {
  const rows = await readJson<ApiListing[]>(`/api/v1/catalogue/experiences/${slug}/related`);
  if (!rows) {
    return seedRelated(slug);
  }
  return rows.map(listingFromApi);
}

export async function loadCollections(): Promise<Idea[]> {
  const rows = await readJson<ApiCollection[]>("/api/v1/catalogue/collections");
  if (!rows?.length) {
    return IDEAS;
  }
  return rows.map(ideaFromApi);
}

export async function loadCollection(slug: string): Promise<Idea | undefined> {
  const row = await readJson<ApiCollection>(`/api/v1/catalogue/collections/${slug}`);
  if (!row) {
    return IDEAS.find((item) => item.slug === slug);
  }
  return ideaFromApi(row);
}

export async function searchCatalogue(q: string) {
  return readJson<{ items: ApiListing[]; relaxations: SearchRelaxation[]; filters: Record<string, string> }>(
    `/api/v1/catalogue/search?q=${encodeURIComponent(q)}`,
  );
}

export async function loadMapListings(filters: ExperienceFilters): Promise<Experience[]> {
  const page = await loadExperiencePage({ ...filters, page: 1, pageSize: 48 });
  return page.items;
}

export function listingCoordinates(item: Experience): { lat: number; lng: number } | null {
  const dest = DESTINATIONS.find((row) => row.slug === item.destinationSlug);
  const fallback: Record<string, { lat: number; lng: number }> = {
    byblos: { lat: 34.123, lng: 35.6481 },
    batroun: { lat: 34.2553, lng: 35.6581 },
    bsharri: { lat: 34.2508, lng: 36.0106 },
    "qadisha-valley": { lat: 34.245, lng: 35.952 },
    baalbek: { lat: 34.0069, lng: 36.2042 },
    beirut: { lat: 33.8938, lng: 35.5018 },
  };
  return fallback[item.destinationSlug] ?? (dest ? fallback.beirut : null);
}

export { EXPERIENCES };
