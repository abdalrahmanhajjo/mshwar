"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBusinessCopy } from "@/lib/business-copy";
import { acceptInvite, inviteStaff, listStaff, revokeInvite, type StaffPayload } from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function TeamView({ inviteToken }: { inviteToken?: string }) {
  const copy = useBusinessCopy();
  const { org, refresh } = usePortal();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("bookings");
  const [staff, setStaff] = React.useState<StaffPayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!org) {
      return;
    }
    try {
      setStaff(await listStaff(org.id));
    } catch {
      setStaff({ members: [], invitations: [] });
    }
  }, [org]);

  React.useEffect(() => {
    if (!org) {
      return;
    }
    let cancelled = false;
    void listStaff(org.id)
      .then((next) => {
        if (!cancelled) {
          setStaff(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStaff({ members: [], invitations: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [org]);

  React.useEffect(() => {
    if (!inviteToken) {
      return;
    }
    let cancelled = false;
    void acceptInvite(inviteToken)
      .then(() => {
        if (!cancelled) {
          return refresh();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : copy.inviteStaff);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [copy.inviteStaff, inviteToken, refresh]);

  async function onInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!org) {
      return;
    }
    setError(null);
    try {
      await inviteStaff(org.id, email, role);
      setEmail("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.inviteStaff);
    }
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{copy.inviteStaff}</CardTitle>
          <CardDescription>{copy.teamHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => void onInvite(event)}>
            <Label htmlFor="staff-email">{copy.inviteStaff}</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <Label htmlFor="staff-role">{copy.roleBookings}</Label>
            <Input id="staff-role" value={role} onChange={(event) => setRole(event.target.value)} />
            <p className="text-sm text-text-muted">
              {copy.roleListings} · {copy.roleBookings} · {copy.roleFinance} · {copy.roleSettings}
            </p>
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit">{copy.inviteStaff}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.roleSettings}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {(staff?.members ?? []).map((member) => (
            <p key={member.user_id}>
              {member.display_name} · {member.email} · {member.role}
            </p>
          ))}
          {(staff?.invitations ?? []).map((invite) => (
            <div key={invite.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {invite.email} · {invite.role}
                {invite.revoked_at ? ` · ${copy.revoke}` : ""}
              </span>
              {!invite.accepted_at && !invite.revoked_at && org ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void revokeInvite(org.id, invite.id).then(reload)}
                >
                  {copy.revoke}
                </Button>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
