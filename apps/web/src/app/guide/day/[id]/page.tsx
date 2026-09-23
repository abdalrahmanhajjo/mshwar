import { ShellMain } from "@/components/shell/app-shell";
import { GuideDaySheet } from "@/components/guide/day-sheet";

export default async function GuideDayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain className="print:p-0">
      <GuideDaySheet dayId={id} />
    </ShellMain>
  );
}
