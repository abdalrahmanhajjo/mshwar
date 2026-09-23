import { ShellMain } from "@/components/shell/app-shell";
import { GuideQueue } from "@/components/admin/guide-queue";

export default function AdminGuidesPage() {
  return (
    <ShellMain>
      <GuideQueue />
    </ShellMain>
  );
}
