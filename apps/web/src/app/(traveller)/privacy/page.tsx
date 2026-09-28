import type { Metadata } from "next";
import { PrivacyPolicyView } from "@/components/legal/legal-views";

export const metadata: Metadata = {
  title: "Privacy policy — Mshwar",
  description: "What Mshwar collects, why, how long it is kept, and your choices.",
};

export default function PrivacyPage() {
  return <PrivacyPolicyView />;
}
