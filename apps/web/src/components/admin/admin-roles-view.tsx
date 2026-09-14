"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>{copy.rolesTitle}</CardTitle>
        <CardDescription>Admin is a distinct role. It cannot be self-granted.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input aria-label="user id" value={userId} onChange={(event) => setUserId(event.target.value)} />
        <Input aria-label="tier" value={tier} onChange={(event) => setTier(event.target.value)} />
        <Input aria-label="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        <Button
          type="button"
          disabled={!elevated || userId === user?.id}
          onClick={() => void grantRole(userId, tier).then(reload)}
        >
          {copy.grantRole}
        </Button>
        <ul className="grid gap-2 text-sm">
          {roles.map((row) => (
            <li key={row.user_id} className="flex items-center justify-between gap-2 border-b border-border py-2">
              <span>
                {row.display_name} {row.email} — {row.tier}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!elevated || row.user_id === user?.id}
                onClick={() => void revokeRole(row.user_id, reason).then(reload)}
              >
                {copy.revokeRole}
              </Button>
            </li>
          ))}
        </ul>
        <h3 className="text-sm font-semibold">{copy.sessionLog}</h3>
        <ul className="text-sm text-text-muted">
          {sessions.map((row) => (
            <li key={`${row.started_at}-${row.ip}`}>
              {row.ip ?? "unknown"} · {row.duration_seconds}s · {row.started_at}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
