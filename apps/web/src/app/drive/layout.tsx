import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { DriverShell } from "@/components/shell/partner-shells";

export const metadata: Metadata = {
  title: "Driver portal — Mshwar",
  robots: { index: false, follow: false },
};

export default function DriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <DriverShell>
      <RequireAuth>{children}</RequireAuth>
    </DriverShell>
  );
}
