import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { ContactView } from "@/components/legal/legal-views";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Contact Mshwar",
    description: "Questions, partnerships or help with a trip — how to reach the Mshwar team.",
    path: "/contact",
  });
}

export default function ContactPage() {
  return <ContactView />;
}
