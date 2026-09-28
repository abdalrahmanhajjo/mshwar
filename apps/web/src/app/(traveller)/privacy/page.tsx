import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { PrivacyPolicyView } from "@/components/legal/legal-views";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Privacy policy — Mshwar",
    description: "What Mshwar collects, why, how long it is kept, and your choices.",
    path: "/privacy",
  });
}

export default function PrivacyPage() {
  return <PrivacyPolicyView />;
}
