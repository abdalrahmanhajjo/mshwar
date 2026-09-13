import { RequireAuth } from "@/components/auth/require-auth";
import { PortalProvider } from "@/components/business/portal-provider";
import { BusinessShell } from "@/components/shell/app-shell";

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return (
    <BusinessShell>
      <RequireAuth>
        <PortalProvider>{children}</PortalProvider>
      </RequireAuth>
    </BusinessShell>
  );
}
