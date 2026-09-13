"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocale } from "@/components/shell/locale-provider";

type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  locale: string;
  status: string;
  email_verified: boolean;
};

export function AdminUsersTable() {
  const { t } = useLocale();
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
    <Card>
      <CardHeader>
        <CardTitle>{t("users")}</CardTitle>
        <CardDescription>{t("verifyToBook")}</CardDescription>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-text-muted">{t("users")}</p>
        ) : (
          <table className="w-full text-start text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="py-2 font-medium">{t("displayName")}</th>
                <th className="py-2 font-medium">{t("email")}</th>
                <th className="py-2 font-medium">{t("verifyEmail")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((row) => (
                <tr key={row.id} className="border-b border-border">
                  <td className="py-2">{row.display_name}</td>
                  <td className="py-2">{row.email}</td>
                  <td className="py-2">{row.email_verified ? t("verified") : t("unverified")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
