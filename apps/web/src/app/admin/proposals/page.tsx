import { ShellMain } from "@/components/shell/app-shell";
import { ProposalQueue } from "@/components/admin/proposal-queue";

export default function AdminProposalsPage() {
  return (
    <ShellMain>
      <ProposalQueue />
    </ShellMain>
  );
}
