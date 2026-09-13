import { AvailabilityView } from "@/components/business/availability-view";
import { ShellMain } from "@/components/shell/app-shell";

export default async function AvailabilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain>
      <AvailabilityView experienceId={id} />
    </ShellMain>
  );
}
