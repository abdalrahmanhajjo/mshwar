import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { RequireAdmin } from "@/components/auth/require-admin";
import { AdminShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "Operations console — Mshwar",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireAdmin>
        <AdminShell>{children}</AdminShell>
      </RequireAdmin>
    </RequireAuth>
  );
}
