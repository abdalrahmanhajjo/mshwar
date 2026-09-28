import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { ShellMain } from "@/components/shell/app-shell";
import { GuideDirectory } from "@/components/guide/guide-directory";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Local guides in Lebanon — Mshwar",
    description: "Local guides and hosts across Lebanon. Licensed guides charge; local hosts do not.",
    path: "/guides",
  });
}

export default function GuidesPage() {
  return (
    <ShellMain>
      <GuideDirectory />
    </ShellMain>
  );
}
