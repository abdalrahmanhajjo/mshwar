import { ConfigFlagsView } from "@/components/admin/config-flags-view";
import { WeatherThresholdsForm } from "@/components/admin/weather-thresholds-form";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminSettingsPage() {
  return (
    <ShellMain>
      <div className="grid gap-6">
        <ConfigFlagsView />
        <WeatherThresholdsForm />
      </div>
    </ShellMain>
  );
}
