import { ShellMain } from "@/components/shell/app-shell";
import { UnsubscribeView } from "@/components/notifications/unsubscribe-view";

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <ShellMain>
      <UnsubscribeView token={token} />
    </ShellMain>
  );
}
