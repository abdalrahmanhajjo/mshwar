"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBusinessCopy } from "@/lib/business-copy";
import { adminVerify, listAdminOrganizations } from "@/lib/portal";

type AdminOrg = {
  id: string;
  name: string;
  slug: string;
  verification: string;
  paused_experiences: number;
  published_experiences: number;
};

export function AdminBusinessesTable() {
  const copy = useBusinessCopy();
  const [rows, setRows] = React.useState<AdminOrg[]>([]);
  const [reason, setReason] = React.useState("Documents reviewed");

  const reload = React.useCallback(async () => {
    try {
      setRows(await listAdminOrganizations());
    } catch {
      setRows([]);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.adminVerify}</CardTitle>
        <CardDescription>{copy.verifiedBadge}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input aria-label={copy.reason} value={reason} onChange={(event) => setReason(event.target.value)} />
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border text-text-muted">
              <th className="py-2 font-medium">{copy.orgName}</th>
              <th className="py-2 font-medium">{copy.verifiedBadge}</th>
              <th className="py-2 font-medium">{copy.paused}</th>
              <th className="py-2 font-medium">{copy.published}</th>
              <th className="py-2 font-medium">{copy.adminVerify}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border">
                <td className="py-2">{row.name}</td>
                <td className="py-2">{row.verification}</td>
                <td className="py-2">{row.paused_experiences}</td>
                <td className="py-2">{row.published_experiences}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void adminVerify(row.id, reason, "verify").then(reload)}
                    >
                      {copy.adminVerify}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void adminVerify(row.id, reason, "reject").then(reload)}
                    >
                      {copy.adminReject}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
