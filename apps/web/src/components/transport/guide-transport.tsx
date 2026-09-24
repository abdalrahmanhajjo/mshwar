"use client";

import * as React from "react";
import { BusFront, Loader2, Plus } from "lucide-react";
import { TransportCardView } from "@/components/local/transport-card";
import { TransportCardForm } from "@/components/transport/transport-card-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { useAdminTrustCopy, type AdminTrustKey } from "@/lib/admin-trust-copy";
import { fetchGuideTransport, submitGuideTransport, type TransportCardPrivate } from "@/lib/transport";

/** The guide's side of V2: propose a transport card; staff check it before travellers see it. */
export function GuideTransport() {
  const copy = useAdminTrustCopy();
  const [cards, setCards] = React.useState<TransportCardPrivate[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetchGuideTransport()
      .then((next) => {
        if (!cancelled) setCards(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="grid gap-4" aria-labelledby="guide-transport">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h2 id="guide-transport" className="title-section flex items-center gap-2 text-[1.2rem]">
            <BusFront className="size-5" aria-hidden />
            {copy.guideTransportTitle}
          </h2>
          <p className="max-w-2xl text-sm text-text-muted">{copy.guideTransportBody}</p>
        </div>
        {open ? null : (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            {copy.newCard}
          </Button>
        )}
      </div>
      {sent ? (
        <Notice tone="success" role="status">
          {copy.saved}
        </Notice>
      ) : null}
      {open ? (
        <div className="rounded-card border border-border bg-surface-raised p-4 md:p-6">
          <TransportCardForm
            submitLabel={copy.submitCard}
            evidenceKinds={["guide_report", "operator"]}
            onCancel={() => setOpen(false)}
            onSubmit={async (input) => {
              const card = await submitGuideTransport(input);
              setCards((current) => [card, ...(current ?? [])]);
              setOpen(false);
              setSent(true);
            }}
          />
        </div>
      ) : null}
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : cards === null ? (
        <Loader2 className="size-5 animate-spin text-text-muted" aria-hidden />
      ) : cards.length ? (
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">{copy.myCards}</h3>
          <ul className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <li key={card.id} className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={card.status === "published" ? "success" : "outline"}>
                    {copy[`tst_${card.status}` as AdminTrustKey]}
                  </Badge>
                  {card.decision_reason ? (
                    <span className="text-sm text-text-muted">{card.decision_reason}</span>
                  ) : null}
                </div>
                <TransportCardView card={card} flaggable={false} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
