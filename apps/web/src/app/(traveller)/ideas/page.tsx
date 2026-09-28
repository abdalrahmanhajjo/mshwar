import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { IdeasView } from "@/components/browse/ideas-view";
import { loadCollections } from "@/lib/catalogue-api";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Trip ideas for Lebanon — Mshwar",
    description: "Sample collections you can adapt to your date, group and budget.",
    path: "/ideas",
  });
}

export default async function IdeasPage() {
  return <IdeasView ideas={await loadCollections()} />;
}
