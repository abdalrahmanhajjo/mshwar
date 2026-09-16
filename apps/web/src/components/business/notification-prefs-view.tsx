"use client";

import * as React from "react";
import { usePortal } from "@/components/business/portal-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  fetchOrgNotificationPrefs,
  saveEscalation,
  saveRoleNotificationPref,
  type OrgNotificationSettings,
} from "@/lib/notifications";
import { useNotificationCopy } from "@/lib/notifications-copy";

const ROLES = ["owner", "manager", "bookings", "inventory", "finance"] as const;
const EVENTS = ["business.booking.requested", "business.request.unanswered"] as const;

export function NotificationPrefsView() {
  const { org } = usePortal();
  if (!org) {
    return null;
  }
  return <NotificationPrefsForm key={org.id} orgId={org.id} />;
}

function NotificationPrefsForm({ orgId }: { orgId: string }) {
  const copy = useNotificationCopy();
  const [settings, setSettings] = React.useState<OrgNotificationSettings | null>(null);
  const [first, setFirst] = React.useState(30);
  const [repeat, setRepeat] = React.useState(60);
  const [max, setMax] = React.useState(3);

  React.useEffect(() => {
    let cancelled = false;
    void fetchOrgNotificationPrefs(orgId)
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setSettings(payload);
        setFirst(payload.escalation.first_minutes);
        setRepeat(payload.escalation.repeat_minutes);
        setMax(payload.escalation.max);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  function enabled(role: string, eventType: string, channel: "email" | "in_app"): boolean {
    const row = settings?.roles.find((item) => item.role === role && item.event_type === eventType);
    if (!row) {
      return role === "owner" || role === "manager" || role === "bookings" || channel === "in_app";
    }
    return channel === "email" ? row.email_enabled : row.in_app_enabled;
  }

  async function toggle(role: string, eventType: string, channel: "email" | "in_app") {
    const email = channel === "email" ? !enabled(role, eventType, "email") : enabled(role, eventType, "email");
    const inApp = channel === "in_app" ? !enabled(role, eventType, "in_app") : enabled(role, eventType, "in_app");
    const next = await saveRoleNotificationPref(orgId, {
      role,
      event_type: eventType,
      email_enabled: email,
      in_app_enabled: inApp,
    });
    setSettings(next);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
      <Card>
        <CardHeader>
          <CardTitle as="h2">{copy.businessPrefsTitle}</CardTitle>
          <CardDescription>{copy.businessPrefsBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 p-0 md:p-0">
          {EVENTS.map((eventType) => (
            <div key={eventType} className="overflow-x-auto">
              <table className="data-table">
                <caption className="px-6 pb-2 text-start font-mono text-xs text-text-muted md:px-7">
                  {eventType}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{copy.roleLabel}</th>
                    <th scope="col">{copy.emailChannel}</th>
                    <th scope="col">{copy.inAppChannel}</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map((role) => (
                    <tr key={`${eventType}-${role}`}>
                      <td className="font-medium capitalize">{role}</td>
                      <td>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={enabled(role, eventType, "email")}
                            onChange={() => void toggle(role, eventType, "email")}
                          />
                          <span className="sr-only">
                            {role} {copy.emailChannel}
                          </span>
                        </label>
                      </td>
                      <td>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={enabled(role, eventType, "in_app")}
                            onChange={() => void toggle(role, eventType, "in_app")}
                          />
                          <span className="sr-only">
                            {role} {copy.inAppChannel}
                          </span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle as="h2">{copy.escalationTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveEscalation(orgId, {
                first_minutes: first,
                repeat_minutes: repeat,
                max,
              }).then(setSettings);
            }}
          >
            <label className="grid gap-2 text-sm font-medium">
              {copy.firstMinutes}
              <Input type="number" min={1} value={first} onChange={(event) => setFirst(Number(event.target.value))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {copy.repeatMinutes}
              <Input type="number" min={1} value={repeat} onChange={(event) => setRepeat(Number(event.target.value))} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {copy.maxEscalations}
              <Input
                type="number"
                min={1}
                max={20}
                value={max}
                onChange={(event) => setMax(Number(event.target.value))}
              />
            </label>
            <Button type="submit" className="w-fit">
              {copy.saveEscalation}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
