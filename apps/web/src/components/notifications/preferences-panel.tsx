"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchConsentHistory, fetchPreferences, savePreferences, type ConsentEvent } from "@/lib/notifications";
import { useNotificationCopy } from "@/lib/notifications-copy";

export function PreferencesPanel() {
  const copy = useNotificationCopy();
  const [marketingEmail, setMarketingEmail] = React.useState(false);
  const [marketingInApp, setMarketingInApp] = React.useState(false);
  const [history, setHistory] = React.useState<ConsentEvent[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchPreferences(), fetchConsentHistory()])
      .then(([prefs, events]) => {
        if (cancelled) {
          return;
        }
        setMarketingEmail(prefs.marketing_email);
        setMarketingInApp(prefs.marketing_in_app);
        setHistory(events);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const next = await savePreferences({
        marketing_email: marketingEmail,
        marketing_in_app: marketingInApp,
      });
      setMarketingEmail(next.marketing_email);
      setMarketingInApp(next.marketing_in_app);
      setHistory(await fetchConsentHistory());
      setStatus(copy.prefsSaved);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="grid gap-6" aria-labelledby="comms-heading">
      <header>
        <h2 id="comms-heading" className="text-3xl font-semibold tracking-tight">
          {copy.prefsTitle}
        </h2>
        <p className="mt-3 text-text-muted">{copy.prefsBody}</p>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>{copy.prefsTitle}</CardTitle>
          <CardDescription>{copy.transactionalAlways}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => void onSave(event)}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={marketingEmail}
                onChange={(event) => setMarketingEmail(event.target.checked)}
              />
              {copy.marketingEmail}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={marketingInApp}
                onChange={(event) => setMarketingInApp(event.target.checked)}
              />
              {copy.marketingInApp}
            </label>
            <Button type="submit" disabled={pending}>
              {copy.savePrefs}
            </Button>
            {status ? <p role="status">{status}</p> : null}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.consentHistory}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 text-sm">
            {history.map((row) => (
              <li key={row.id}>
                {row.purpose}: {row.granted ? copy.granted : copy.revoked}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
