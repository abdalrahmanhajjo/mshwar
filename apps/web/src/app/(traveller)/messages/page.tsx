import { MessagesInbox } from "@/components/messages/messages-view";
import { ShellMain } from "@/components/shell/app-shell";

export default function MessagesPage() {
  return (
    <ShellMain>
      <MessagesInbox />
    </ShellMain>
  );
}
