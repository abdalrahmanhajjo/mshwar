"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { BellRing, Mail, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/notice";
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
    <section
      id="communication"
      className="scroll-mt-28 overflow-hidden rounded-card border border-border-subtle bg-surface-raised shadow-sm"
      aria-labelledby="comms-heading"
    >
      <header className="grid gap-1.5 p-6 md:p-7">
        <h2 id="comms-heading" className="title-card">
          {copy.prefsTitle}
        </h2>
        <p className="text-sm leading-relaxed text-text-muted">{copy.prefsBody}</p>
      </header>
      <div className="grid gap-6 px-6 pb-6 md:px-7 md:pb-7">
        <Notice icon={<ShieldCheck aria-hidden />}>{copy.transactionalAlways}</Notice>
        <form className="grid gap-3" onSubmit={(event) => void onSave(event)}>
          <ToggleRow
            icon={<Mail aria-hidden />}
            label={copy.marketingEmail}
            checked={marketingEmail}
            onChange={setMarketingEmail}
          />
          <ToggleRow
            icon={<BellRing aria-hidden />}
            label={copy.marketingInApp}
            checked={marketingInApp}
            onChange={setMarketingInApp}
          />
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" disabled={pending}>
              {copy.savePrefs}
            </Button>
            {status ? (
              <p role="status" className="text-sm text-success">
                {status}
              </p>
            ) : null}
          </div>
        </form>
        {history.length ? (
          <div className="grid gap-3 border-t border-border-subtle pt-5">
            <h3 className="text-sm font-semibold">{copy.consentHistory}</h3>
            <ul className="grid gap-2 text-sm">
              {history.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-control bg-surface-sunken px-3.5 py-2.5"
                >
                  <span>{row.purpose}</span>
                  <Badge variant={row.granted ? "success" : "outline"}>
                    {row.granted ? copy.granted : copy.revoked}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="grid gap-1 border-t border-border-subtle pt-5">
            <h3 className="text-sm font-semibold">{copy.consentHistory}</h3>
          </div>
        )}
      </div>
    </section>
  );
}

export function ToggleRow({
  icon,
  label,
  checked,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-control border border-border-subtle px-4 py-3.5 transition-colors hover:bg-surface-sunken/60">
      <span className="flex items-center gap-3 text-sm font-medium">
        {icon ? <span className="text-text-muted [&_svg]:size-[1.1rem]">{icon}</span> : null}
        {label}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-6 w-11 shrink-0 rounded-pill bg-border transition-colors after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-surface-raised after:shadow-sm after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 rtl:peer-checked:after:-translate-x-5"
      />
    </label>
  );
}
