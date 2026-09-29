import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TourBookingsLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
