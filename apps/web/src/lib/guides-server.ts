import "server-only";
import type { PublicGuide } from "@/lib/guides";

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
