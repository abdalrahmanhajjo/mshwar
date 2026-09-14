import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { ShellMain } from "@/components/shell/app-shell";

export default function AdminTaxonomyPage() {
  return (
    <ShellMain>
      <TaxonomyManager />
    </ShellMain>
  );
}
