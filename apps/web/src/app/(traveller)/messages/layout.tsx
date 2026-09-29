import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
