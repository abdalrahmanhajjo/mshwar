import type { Metadata } from "next";
import { ShellMain } from "@/components/shell/app-shell";
import { GuideAgreementView } from "@/components/guide/guide-agreement";

export const metadata: Metadata = { title: "Guide agreement and code of conduct — Mshwar" };

export default function GuideAgreementPage() {
  return (
    <ShellMain>
      <GuideAgreementView />
    </ShellMain>
  );
}
