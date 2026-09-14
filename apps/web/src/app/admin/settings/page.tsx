import { ConfigFlagsView } from "@/components/admin/config-flags-view";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminSettingsPage() {
  return (
    <ShellMain>
      <ConfigFlagsView />
    </ShellMain>
  );
}
