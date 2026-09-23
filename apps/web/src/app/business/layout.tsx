import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RequireAuth } from "@/components/auth/require-auth";
import { LegacyBusinessShell } from "@/components/business/legacy-business-shell";
import { PortalProvider } from "@/components/business/portal-provider";
import { businessPortalEnabled } from "@/lib/features";

export const metadata: Metadata = {
  title: "Business portal — Mshwar",
  robots: { index: false, follow: false },
};

/** Hidden, not deleted: every /business page 404s unless NEXT_PUBLIC_BUSINESS_PORTAL=true. */
export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  if (!businessPortalEnabled()) {
    notFound();
  }
  return (
    <LegacyBusinessShell>
      <RequireAuth>
        <PortalProvider>{children}</PortalProvider>
      </RequireAuth>
    </LegacyBusinessShell>
  );
}
