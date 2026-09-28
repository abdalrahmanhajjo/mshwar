import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { CommunityGuidelinesView } from "@/components/legal/legal-views";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Community guidelines — Mshwar",
    description: "How travellers, guides and partners are expected to treat each other on Mshwar.",
    path: "/community-guidelines",
  });
}

export default function CommunityGuidelinesPage() {
  return <CommunityGuidelinesView />;
}
