import type { AuthScene, AuthVisual } from "@/components/auth/auth-layout";
import { loadDestinations } from "@/lib/catalogue-api";

/** Which real places each auth screen shows, best first. */
const SCENES: Record<AuthScene, string[]> = {
  signup: ["qadisha-valley", "bsharri", "north-lebanon"],
  signin: ["byblos", "batroun", "mount-lebanon"],
  verify: ["bsharri", "qadisha-valley", "north-lebanon"],
  recover: ["batroun", "byblos", "south-lebanon"],
};

/**
 * A catalogue destination photo for the auth side panel. None when the catalogue
 * has no photo for these places: the panel then shows the brand, not a stand-in.
 */
export async function loadAuthVisual(scene: AuthScene): Promise<AuthVisual | null> {
  const destinations = (await loadDestinations()).filter((item) => item.image);
  const pick = SCENES[scene].map((slug) => destinations.find((item) => item.slug === slug)).find(Boolean);
  if (!pick) {
    return null;
  }
  return { image: pick.image, alt: pick.imageAlt || pick.name, name: pick.name, region: pick.region };
}
