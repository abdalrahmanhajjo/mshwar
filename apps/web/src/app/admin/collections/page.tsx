import { AdminCollectionsHeader } from "@/components/admin/admin-page-headers";
import { CollectionEditor } from "@/components/admin/collection-editor";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminCollectionsPage() {
  return (
    <ShellMain>
      <AdminCollectionsHeader />
      <CollectionEditor />
    </ShellMain>
  );
}
