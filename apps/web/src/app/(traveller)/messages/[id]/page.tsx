import { ConversationThread } from "@/components/messages/messages-view";
import { ShellMain } from "@/components/shell/app-shell";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain>
      <ConversationThread id={id} />
    </ShellMain>
  );
}
