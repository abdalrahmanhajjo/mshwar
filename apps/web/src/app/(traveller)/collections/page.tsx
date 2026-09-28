import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { CollectionsView } from "@/components/browse/collections-view";
import { loadCollections } from "@/lib/catalogue-api";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Ready-made days in Lebanon — Mshwar",
    description: "Curated collections assembled from published inventory.",
    path: "/collections",
  });
}

export default async function CollectionsPage() {
  return <CollectionsView collections={await loadCollections()} />;
}
