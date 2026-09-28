import type { Metadata } from "next";
import { IdeasView } from "@/components/browse/ideas-view";
import { loadCollections } from "@/lib/catalogue-api";

export const metadata: Metadata = {
  title: "Trip ideas for Lebanon — Mshwar",
  description: "Sample collections you can adapt to your date, group and budget.",
};

export default async function IdeasPage() {
  return <IdeasView ideas={await loadCollections()} />;
}
