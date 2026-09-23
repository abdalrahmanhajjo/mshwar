import { ShellMain } from "@/components/shell/app-shell";
import { HireAGuide } from "@/components/guide/hire-a-guide";

export default async function HireAGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain>
      <HireAGuide tripId={id} />
    </ShellMain>
  );
}
