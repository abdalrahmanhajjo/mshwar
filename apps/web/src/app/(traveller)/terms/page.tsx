import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { TermsView } from "@/components/legal/legal-views";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Terms of service — Mshwar",
    description: "The terms for using Mshwar to discover, plan and book in Lebanon.",
    path: "/terms",
  });
}

export default function TermsPage() {
  return <TermsView />;
}
