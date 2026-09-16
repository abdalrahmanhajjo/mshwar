"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { KeyRound } from "lucide-react";
import { AdminHeader, EmptyRow, ReasonField, TableShell } from "@/components/admin/admin-ui";
import { Avatar } from "@/components/shell/auth-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Input } from "@/components/ui/input";
import { grantRole, isElevatedTier, listAdminSessions, listRoles, revokeRole } from "@/lib/admin";
import { useAdminCopy } from "@/lib/admin-copy";
import { useAuth } from "@/components/shell/auth-provider";

export function AdminRolesView() {
  const copy = useAdminCopy();
  const { user } = useAuth();
  const elevated = isElevatedTier(user?.admin_tier);
  const [userId, setUserId] = React.useState("");
  const [tier, setTier] = React.useState("ops");
  const [reason, setReason] = React.useState("Operations staffing");
  const [roles, setRoles] = React.useState<{ user_id: string; email: string; display_name: string; tier: string }[]>(
    [],
  );
  const [sessions, setSessions] = React.useState<{ ip: string | null; duration_seconds: number; started_at: string }[]>(
    [],
  );

  const reload = React.useCallback(async () => {
    try {
      setRoles(await listRoles());
      setSessions(await listAdminSessions());
    } catch {
      setRoles([]);
      setSessions([]);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([listRoles(), listAdminSessions()])
      .then(([nextRoles, nextSessions]) => {
        if (!cancelled) {
          setRoles(nextRoles);
          setSessions(nextSessions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoles([]);
          setSessions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <AdminHeader title={copy.rolesTitle} description={copy.rolesNote} />
      {elevated ? null : <Notice tone="warning">{copy.elevatedOnly}</Notice>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.grantRole}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="grid gap-2 text-label font-medium">
              {copy.userIdLabel}
              <Input aria-label="user id" value={userId} onChange={(event) => setUserId(event.target.value)} />
            </label>
            <label className="grid gap-2 text-label font-medium">
              {copy.tierLabel}
              <NativeSelect aria-label="tier" value={tier} onChange={(event) => setTier(event.target.value)}>
                <option value="ops">ops</option>
                <option value="elevated">elevated</option>
              </NativeSelect>
            </label>
            <ReasonField id="roles-reason" value={reason} onChange={setReason} />
            <Button
              type="button"
              disabled={!elevated || userId === user?.id}
              onClick={() => void grantRole(userId, tier).then(reload)}
            >
              <KeyRound aria-hidden />
              {copy.grantRole}
            </Button>
          </CardContent>
        </Card>
        <div className="grid gap-6">
          <TableShell>
            <thead>
              <tr>
                <th scope="col">{copy.nameCol}</th>
                <th scope="col">{copy.tierLabel}</th>
                <th scope="col">{copy.actionsCol}</th>
              </tr>
            </thead>
            <tbody>
              {roles.length === 0 ? <EmptyRow colSpan={3} label={copy.queueEmpty} /> : null}
              {roles.map((row) => (
                <tr key={row.user_id}>
                  <td>
                    <span className="flex items-center gap-3">
                      <Avatar name={row.display_name} className="size-9 text-xs" />
                      <span className="grid">
                        <span className="font-medium">{row.display_name}</span>
                        <span className="text-xs text-text-muted">{row.email}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <Badge variant={row.tier === "elevated" ? "accent" : "secondary"}>{row.tier}</Badge>
                  </td>
                  <td>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!elevated || row.user_id === user?.id}
                      onClick={() => void revokeRole(row.user_id, reason).then(reload)}
                    >
                      {copy.revokeRole}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.sessionLog}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 text-sm">
                {sessions.map((row) => (
                  <li
                    key={`${row.started_at}-${row.ip}`}
                    className="grid grid-cols-[1fr_auto_auto] gap-4 rounded-control bg-surface-sunken px-3.5 py-2.5"
                  >
                    <span className="font-mono text-xs">{row.ip ?? copy.unknownIp}</span>
                    <span className="tabular-nums text-text-muted">{row.duration_seconds}s</span>
                    <span className="text-xs text-text-muted">{row.started_at}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
