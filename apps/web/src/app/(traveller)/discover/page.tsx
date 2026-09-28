import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { DiscoverView } from "@/components/browse/discover-view";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Discover Lebanon — Mshwar",
    description: "Destinations, experiences, attractions, restaurants and a few ready-made days.",
    path: "/discover",
  });
}

export default function DiscoverPage() {
  return <DiscoverView />;
}
