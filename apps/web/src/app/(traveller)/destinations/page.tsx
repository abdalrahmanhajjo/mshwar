import type { Metadata } from "next";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { seoText } from "@/lib/seo-copy";
import { DestinationsView } from "@/components/browse/destinations-view";
import { loadDestinations } from "@/lib/catalogue-api";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pathLocale();
  return buildMetadata({
    title: seoText(locale, "destinationsTitle"),
    description: seoText(locale, "destinationsDescription"),
    path: "/destinations",
  });
}

export default async function DestinationsPage() {
  return <DestinationsView destinations={await loadDestinations()} />;
}
