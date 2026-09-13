import { RequireAuth } from "@/components/auth/require-auth";

export default function BookingsLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
