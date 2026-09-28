import type { Metadata } from "next";
import { ShellMain } from "@/components/shell/app-shell";
import { GuideDirectory } from "@/components/guide/guide-directory";

export const metadata: Metadata = {
  title: "Local guides in Lebanon — Mshwar",
  description: "Local guides and hosts across Lebanon. Licensed guides charge; local hosts do not.",
};

export default function GuidesPage() {
  return (
    <ShellMain>
      <GuideDirectory />
    </ShellMain>
  );
}
