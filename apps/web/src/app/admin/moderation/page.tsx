import { ModerationQueue } from "@/components/admin/moderation-queue";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminModerationPage() {
  return (
    <ShellMain>
      <ModerationQueue />
    </ShellMain>
  );
}
