import { ShellMain } from "@/components/shell/app-shell";
import { EngagementDetail } from "@/components/guide/engagement-detail";

export default async function GuideEngagementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain>
      <EngagementDetail engagementId={id} />
    </ShellMain>
  );
}
