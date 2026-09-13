import { RequireAuth } from "@/components/auth/require-auth";

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
