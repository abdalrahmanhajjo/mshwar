import { PreferencesPanel } from "@/components/notifications/preferences-panel";
import { PrivacyPanel } from "@/components/privacy/privacy-panel";
import { ProfileForm } from "@/components/profile/profile-form";
import { ShellMain } from "@/components/shell/app-shell";

export default function SettingsPage() {
  return (
    <ShellMain>
      <div className="grid gap-10">
        <ProfileForm />
        <PreferencesPanel />
        <PrivacyPanel />
      </div>
    </ShellMain>
  );
}
