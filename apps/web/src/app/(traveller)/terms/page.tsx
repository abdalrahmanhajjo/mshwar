import type { Metadata } from "next";
import { TermsView } from "@/components/legal/legal-views";

export const metadata: Metadata = {
  title: "Terms of service — Mshwar",
  description: "The terms for using Mshwar to discover, plan and book in Lebanon.",
};

export default function TermsPage() {
  return <TermsView />;
}
