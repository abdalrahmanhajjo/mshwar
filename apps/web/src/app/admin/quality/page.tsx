import { DataQualityView } from "@/components/admin/data-quality-view";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminQualityPage() {
  return (
    <ShellMain>
      <DataQualityView />
    </ShellMain>
  );
}
