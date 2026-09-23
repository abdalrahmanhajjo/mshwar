import "server-only";
import type { PublicGuide } from "@/lib/guides";
import type { PublicTour } from "@/lib/guide-work";
import type { PlaceContributor } from "@/lib/guide-contribute";

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
