import type { Metadata } from "next";
import { CommunityGuidelinesView } from "@/components/legal/legal-views";

export const metadata: Metadata = {
  title: "Community guidelines — Mshwar",
  description: "How travellers, guides and partners are expected to treat each other on Mshwar.",
};

export default function CommunityGuidelinesPage() {
  return <CommunityGuidelinesView />;
}
