import { AuditLogView } from "@/components/admin/audit-log-view";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminAuditPage() {
  return (
    <ShellMain>
      <AuditLogView />
    </ShellMain>
  );
}
