import { KpiDashboard } from "@/components/admin/kpi-dashboard";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminOverviewPage() {
  return (
    <ShellMain>
      <KpiDashboard />
    </ShellMain>
  );
}
