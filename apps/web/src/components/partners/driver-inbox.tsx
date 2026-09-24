"use client";

import * as React from "react";
import { Inbox, Loader2, Send } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { RideSummary } from "@/components/partners/ride-summary";
import { errorText } from "@/components/partners/step";
import { interpolate } from "@/i18n/catalogues";
import { formatCurrency } from "@/i18n/format";
import { beirutDateTime } from "@/lib/local-time";
import { fetchMyPartner, type MyPartner, type Vehicle } from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { fetchDriverInbox, sendQuote, withdrawQuote, type DriverInboxItem } from "@/lib/rides";
import { useVerifiedCopy } from "@/lib/verified-copy";

function QuoteForm({
  item,
  vehicles,
  onChange,
}: {
  item: DriverInboxItem;
  vehicles: Vehicle[];
  onChange: (next: DriverInboxItem | null) => void;
}) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { locale } = useLocale();
  const fitting = vehicles.filter((vehicle) => vehicle.live && vehicle.seats >= item.party_size);
  const offered = item.my_quote?.status === "offered" ? item.my_quote : null;
  const [vehicleId, setVehicleId] = React.useState(fitting[0]?.id ?? "");
  const [price, setPrice] = React.useState(offered ? String(offered.price_minor / 100) : "");
  const [note, setNote] = React.useState(offered?.note ?? "");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      onChange(await sendQuote(item.id, vehicleId, Math.round(Number(price) * 100), note.trim()));
      setMessage({ tone: "success", text: copy.quoteSent });
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, verified.loadError) });
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    try {
      await withdrawQuote(item.id);
      onChange({ ...item, my_quote: item.my_quote ? { ...item.my_quote, status: "withdrawn" } : null });
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, verified.loadError) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 border-t border-border-subtle pt-4" onSubmit={(event) => void send(event)}>
      {offered ? (
        <p className="text-sm font-medium" role="status">
          {interpolate(copy.yourQuote, { price: formatCurrency(locale, offered.price_minor / 100, offered.currency) })}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="grid gap-1.5">
          <Label htmlFor={`quote-vehicle-${item.id}`}>{copy.quoteVehicle}</Label>
          <NativeSelect
            id={`quote-vehicle-${item.id}`}
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            {fitting.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.make} {vehicle.model} · {vehicle.plate}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`quote-price-${item.id}`}>{copy.quotePrice}</Label>
          <Input
            id={`quote-price-${item.id}`}
            type="number"
            min={1}
            max={2000}
            step={1}
            dir="ltr"
            required
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`quote-note-${item.id}`}>{copy.quoteNote}</Label>
        <Input
          id={`quote-note-${item.id}`}
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {message ? (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !vehicleId || !price}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
          {offered ? copy.updateQuote : copy.sendQuote}
        </Button>
        {offered ? (
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void withdraw()}>
            {copy.withdrawQuote}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** /drive/requests: open requests in the driver's areas, and their fixed prices. */
export function DriverInbox() {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { locale } = useLocale();
  const [partner, setPartner] = React.useState<MyPartner | null | undefined>(undefined);
  const [items, setItems] = React.useState<DriverInboxItem[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchMyPartner("driver"), fetchDriverInbox().catch(() => [])])
      .then(([me, inbox]) => {
        if (!cancelled) {
          setPartner(me);
          setItems(inbox);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const replace = (next: DriverInboxItem | null, id: string) =>
    setItems((current) => (current ?? []).map((item) => (item.id === id && next ? { ...item, ...next } : item)));

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={copy.driveKicker}
        icon={<Inbox aria-hidden />}
        title={copy.inboxTitle}
        description={copy.inboxBody}
      />
      {failed ? (
        <Notice tone="danger" role="alert">
          {verified.loadError}
        </Notice>
      ) : partner === undefined || items === null ? (
        <div className="grid place-items-center py-16 text-text-muted">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : !partner?.live ? (
        <EmptyState icon={<Inbox aria-hidden />} title={copy.inboxNotLive} />
      ) : items.length === 0 ? (
        <EmptyState icon={<Inbox aria-hidden />} title={copy.inboxEmpty} />
      ) : (
        <ul className="grid gap-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <RideSummary request={item} />
                <span className="grid justify-items-end gap-1 text-xs text-text-muted">
                  <span>{interpolate(copy.quotesSoFar, { n: String(item.quotes_so_far) })}</span>
                  <span>{interpolate(copy.expires, { time: beirutDateTime(locale, item.expires_at) })}</span>
                </span>
              </div>
              <QuoteForm item={item} vehicles={partner.vehicles} onChange={(next) => replace(next, item.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
