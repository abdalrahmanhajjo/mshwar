import { ShellMain } from "@/components/shell/app-shell";
import { AdminUsersTable } from "@/components/admin/admin-users-table";

export default function AdminUsersPage() {
  return (
    <ShellMain>
      <AdminUsersTable />
    </ShellMain>
  );
}
