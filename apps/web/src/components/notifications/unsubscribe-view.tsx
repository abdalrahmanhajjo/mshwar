"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { applyUnsubscribe, lookupUnsubscribe } from "@/lib/notifications";
import { useNotificationCopy } from "@/lib/notifications-copy";

export function UnsubscribeView({ token }: { token: string }) {
  const copy = useNotificationCopy();
  const [valid, setValid] = React.useState<boolean | null>(null);
  const [done, setDone] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void lookupUnsubscribe(token)
      .then(() => {
        if (!cancelled) {
          setValid(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setValid(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onUnsubscribe() {
    setPending(true);
    try {
      await applyUnsubscribe(token);
      setDone(true);
    } catch {
      setValid(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.unsubTitle}</CardTitle>
        <CardDescription>{copy.unsubBody}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {valid === false ? (
          <p role="alert" className="text-sm text-danger">
            {copy.unsubInvalid}
          </p>
        ) : null}
        {done ? <p role="status">{copy.unsubDone}</p> : null}
        {valid && !done ? (
          <Button type="button" disabled={pending} onClick={() => void onUnsubscribe()}>
            {copy.unsubAction}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
