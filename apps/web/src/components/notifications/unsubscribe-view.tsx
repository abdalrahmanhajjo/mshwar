"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { MailCheck, MailX } from "lucide-react";
import { Notice } from "@/components/ui/notice";
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
    <div className="mx-auto grid w-full max-w-lg gap-6 rounded-[1.75rem] border border-border-subtle bg-surface-raised p-7 text-center shadow-lg md:p-10">
      <span className="mx-auto grid size-14 place-items-center rounded-full bg-brand-subtle">
        {done ? <MailCheck className="size-6" aria-hidden /> : <MailX className="size-6" aria-hidden />}
      </span>
      <div className="grid gap-2">
        <h1 className="title-page text-[2.2rem]">{copy.unsubTitle}</h1>
        <p className="text-sm text-text-muted">{copy.unsubBody}</p>
      </div>
      {valid === false ? (
        <Notice tone="danger" role="alert" className="text-start">
          {copy.unsubInvalid}
        </Notice>
      ) : null}
      {done ? (
        <Notice tone="success" className="text-start">
          <p role="status">{copy.unsubDone}</p>
        </Notice>
      ) : null}
      {valid && !done ? (
        <Button type="button" size="lg" disabled={pending} onClick={() => void onUnsubscribe()}>
          {copy.unsubAction}
        </Button>
      ) : null}
    </div>
  );
}
