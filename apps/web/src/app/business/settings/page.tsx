import { NotificationPrefsView } from "@/components/business/notification-prefs-view";
import { SettingsView } from "@/components/business/settings-view";
import { ShellMain } from "@/components/shell/app-shell";

export default function BusinessSettingsPage() {
  return (
    <ShellMain>
      <div className="grid gap-10">
        <SettingsView />
        <NotificationPrefsView />
      </div>
    </ShellMain>
  );
}
