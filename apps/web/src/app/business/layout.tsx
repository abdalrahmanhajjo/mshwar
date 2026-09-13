import { RequireAuth } from "@/components/auth/require-auth";
import { BusinessShell } from "@/components/shell/app-shell";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <BusinessShell>
      <RequireAuth>{children}</RequireAuth>
    </BusinessShell>
  );
}
