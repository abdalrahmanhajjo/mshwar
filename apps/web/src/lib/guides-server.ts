import "server-only";
import type { FoundingProgramme, PublicGuide } from "@/lib/guides";
import type { PublicTour } from "@/lib/guide-work";
import type { PlaceContributor } from "@/lib/guide-contribute";
import type { PublicGuideReviews } from "@/lib/guide-day";
import type { PublicTourPage, TourCard, TourSearch } from "@/lib/tour-booking";

const API_ROOT = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const REVALIDATE_SECONDS = 60;

/** A guide's public page, read on the server so the page can be indexed. */
export async function loadGuide(slug: string): Promise<PublicGuide | null> {
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/${encodeURIComponent(slug)}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as PublicGuide;
  } catch {
    // An API that is down must not render a 500 over a page that is simply absent.
    return null;
  }
}

/** A guide's published tours with their next open dates. Short-lived: dates fill up. */
export async function loadGuideTours(slug: string): Promise<PublicTour[]> {
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/${encodeURIComponent(slug)}/tours`, {
      next: { revalidate: 30 },
    });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as PublicTour[];
  } catch {
    return [];
  }
}

/** Guides who added or corrected a place, for the credit line on its page. */
export async function loadPlaceContributors(slug: string): Promise<PlaceContributor[]> {
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/places/${encodeURIComponent(slug)}/contributors`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as PlaceContributor[];
  } catch {
    return [];
  }
}

/** Released traveller reviews of a guide. */
export async function loadGuideReviews(slug: string): Promise<PublicGuideReviews | null> {
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/${encodeURIComponent(slug)}/reviews`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
    return response.ok ? ((await response.json()) as PublicGuideReviews) : null;
  } catch {
    return null;
  }
}

/** The Founding Guide count for "Earn with Mshwar". Null when the API cannot say: no number is shown then. */
export async function loadFoundingProgramme(): Promise<FoundingProgramme | null> {
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/programme`, { next: { revalidate: 300 } });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as FoundingProgramme;
    return typeof body?.remaining === "number" && typeof body?.limit === "number" ? body : null;
  } catch {
    return null;
  }
}

/** One published tour with its guide and booking terms. Short-lived: terms and prices change. */
export async function loadTour(slug: string): Promise<PublicTourPage | null> {
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/tours/${encodeURIComponent(slug)}`, {
      next: { revalidate: 30 },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as PublicTourPage;
  } catch {
    return null;
  }
}

export type TourFilters = {
  q?: string;
  destination?: string;
  language?: string;
  date?: string;
  max_duration?: string;
  max_price?: string;
  instant?: string;
  sort?: string;
};

/** The tours marketplace, read on the server so the list is indexable. */
export async function loadTours(filters: TourFilters): Promise<TourSearch | null> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      query.set(key, value);
    }
  }
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/tours?${query.toString()}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as TourSearch;
  } catch {
    return null;
  }
}

/** Guided tours that start in one destination. */
export async function loadDestinationTours(slug: string): Promise<TourCard[]> {
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/destinations/${encodeURIComponent(slug)}/tours`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as TourCard[];
  } catch {
    return [];
  }
}

/** Every listed tour, for the sitemap. */
export async function loadTourSlugs(): Promise<{ slug: string; updated_at: string }[]> {
  try {
    const response = await fetch(`${API_ROOT}/api/v1/guides/tour-slugs`, { next: { revalidate: 3600 } });
    if (!response.ok) {
      return [];
    }
    return (await response.json()) as { slug: string; updated_at: string }[];
  } catch {
    return [];
  }
}
