import type { Metadata } from "next";
import { ShellPage } from "@/components/shell/shell-page";

export const metadata: Metadata = {
  title: "Mshwar",
  description: "AI-Powered Lebanon Trip & Experience Platform",
};

export default function Home() {
  return (
    <ShellPage
      title="Discover Lebanon"
      description="Start from a destination, dates and party size. We will not invent businesses."
    />
  );
}
