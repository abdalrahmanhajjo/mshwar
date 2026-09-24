import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { ChangerShell } from "@/components/shell/partner-shells";

export const metadata: Metadata = {
  title: "Money changer portal — Mshwar",
  robots: { index: false, follow: false },
};

export default function ExchangeLayout({ children }: { children: React.ReactNode }) {
  return (
    <ChangerShell>
      <RequireAuth>{children}</RequireAuth>
    </ChangerShell>
  );
}
