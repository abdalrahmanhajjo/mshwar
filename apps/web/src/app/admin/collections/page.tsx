import { CollectionEditor } from "@/components/admin/collection-editor";
import { ShellPage } from "@/components/shell/shell-page";

export default function AdminCollectionsPage() {
  return (
    <ShellPage title="Collections" description="Assemble collections from existing published experiences.">
      <CollectionEditor />
    </ShellPage>
  );
}
