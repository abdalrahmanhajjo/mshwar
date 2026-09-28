import type { Metadata } from "next";
import { CancellationPolicyView } from "@/components/legal/legal-views";

export const metadata: Metadata = {
  title: "Cancellation policy — Mshwar",
  description: "How cancellations and refunds work for bookings made through Mshwar.",
};

export default function CancellationPolicyPage() {
  return <CancellationPolicyView />;
}
