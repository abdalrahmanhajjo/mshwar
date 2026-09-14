import { NotificationHealthView } from "@/components/admin/notification-health";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminNotificationsPage() {
  return (
    <ShellMain>
      <NotificationHealthView />
    </ShellMain>
  );
}
