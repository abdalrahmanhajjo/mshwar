import type { Metadata } from "next";
import { ContactView } from "@/components/legal/legal-views";

export const metadata: Metadata = {
  title: "Contact Mshwar",
  description: "Questions, partnerships or help with a trip — how to reach the Mshwar team.",
};

export default function ContactPage() {
  return <ContactView />;
}
