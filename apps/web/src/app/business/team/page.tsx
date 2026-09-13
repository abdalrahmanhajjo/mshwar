import { TeamView } from "@/components/business/team-view";
import { ShellMain } from "@/components/shell/app-shell";

export default async function BusinessTeamPage({ searchParams }: { searchParams: Promise<{ invite?: string }> }) {
  const params = await searchParams;
  return (
    <ShellMain>
      <TeamView inviteToken={params.invite} />
    </ShellMain>
  );
}
