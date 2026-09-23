import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { GuideProvider } from "@/components/guide/guide-provider";
import { GuideShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "Guide portal — Mshwar",
  robots: { index: false, follow: false },
};

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuideShell>
      <RequireAuth>
        <GuideProvider>{children}</GuideProvider>
      </RequireAuth>
    </GuideShell>
  );
}
