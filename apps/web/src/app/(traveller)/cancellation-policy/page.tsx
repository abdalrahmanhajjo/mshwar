import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { CancellationPolicyView } from "@/components/legal/legal-views";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Cancellation policy — Mshwar",
    description: "How cancellations and refunds work for bookings made through Mshwar.",
    path: "/cancellation-policy",
  });
}

export default function CancellationPolicyPage() {
  return <CancellationPolicyView />;
}
