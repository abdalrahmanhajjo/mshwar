"use client";

import * as React from "react";
import { Mail, UserPlus } from "lucide-react";
import { Avatar } from "@/components/shell/auth-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
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

  const roles = [
    ["bookings", copy.roleBookings],
    ["inventory", copy.roleListings],
    ["finance", copy.roleFinance],
    ["manager", copy.roleSettings],
  ] as const;

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={copy.portalKicker} title={copy.teamTitle} description={copy.teamHint} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.inviteStaff}</CardTitle>
            <CardDescription>{copy.teamHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void onInvite(event)}>
              <div className="grid gap-2">
                <Label htmlFor="staff-email">{copy.emailLabel}</Label>
                <Input
                  id="staff-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="staff-role">{copy.roleLabel}</Label>
                <NativeSelect id="staff-role" value={role} onChange={(event) => setRole(event.target.value)}>
                  {roles.map(([value, label]) => (
                    <option key={value} value={value}>
                      {value} · {label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {error ? (
                <Notice tone="danger" role="alert">
                  {error}
                </Notice>
              ) : null}
              <Button type="submit">
                <UserPlus aria-hidden />
                {copy.inviteStaff}
              </Button>
            </form>
          </CardContent>
        </Card>
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.membersTitle}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 md:p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">{copy.membersTitle}</th>
                      <th scope="col">{copy.roleLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(staff?.members ?? []).map((member) => (
                      <tr key={member.user_id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <Avatar name={member.display_name} className="size-9 text-xs" />
                            <div className="grid">
                              <span className="font-medium">{member.display_name}</span>
                              <span className="text-xs text-text-muted">{member.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge variant="secondary">{member.role}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{copy.invitesTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {(staff?.invitations ?? []).map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle px-4 py-3"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="size-4 text-text-muted" aria-hidden />
                    <span className="font-medium">{invite.email}</span>
                    <Badge variant="outline">{invite.role}</Badge>
                    {invite.revoked_at ? <Badge variant="danger">{copy.revoke}</Badge> : null}
                    {invite.accepted_at ? <Badge variant="success">✓</Badge> : null}
                  </span>
                  {!invite.accepted_at && !invite.revoked_at && org ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
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
      </div>
    </div>
  );
}
