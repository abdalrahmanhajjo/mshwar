"use client";

import * as React from "react";
import { AdminHeader, EmptyRow, TableShell } from "@/components/admin/admin-ui";
import { Avatar } from "@/components/shell/auth-status";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { useAdminCopy } from "@/lib/admin-copy";
import { statusTone } from "@/lib/status";

type AdminUser = {
  id: string;
  email: string | null;
  display_name: string;
  locale: string;
  status: string;
  email_verified: boolean;
};

export function AdminUsersTable() {
  const { t } = useLocale();
  const copy = useAdminCopy();
  const [users, setUsers] = React.useState<AdminUser[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/v1/admin/users", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          return [];
        }
        return (await response.json()) as AdminUser[];
      })
      .then((rows) => {
        if (!cancelled) {
          setUsers(rows);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <AdminHeader title={t("users")} description={copy.usersBody} />
      <TableShell>
        <thead>
          <tr>
            <th scope="col">{t("displayName")}</th>
            <th scope="col">{t("email")}</th>
            <th scope="col">{copy.languageCol}</th>
            <th scope="col">{copy.statusCol}</th>
            <th scope="col">{t("verifyEmail")}</th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? <EmptyRow colSpan={5} label={copy.queueEmpty} /> : null}
          {users.map((row) => (
            <tr key={row.id}>
              <td>
                <span className="flex items-center gap-3">
                  <Avatar name={row.display_name} className="size-9 text-xs" />
                  <span className="font-medium">{row.display_name}</span>
                </span>
              </td>
              <td className="text-text-muted">{row.email ?? "—"}</td>
              <td className="uppercase">{row.locale}</td>
              <td>
                <Badge variant={statusTone(row.status)}>{row.status}</Badge>
              </td>
              <td>
                <Badge variant={row.email_verified ? "success" : "warning"}>
                  {row.email_verified ? t("verified") : t("unverified")}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}
