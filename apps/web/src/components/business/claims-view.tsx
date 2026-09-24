"use client";

import * as React from "react";
import { Loader2, Send, Store } from "lucide-react";
import { usePortal } from "@/components/business/portal-provider";
import { PlaceSearch } from "@/components/guide/place-search";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import type { PlaceHit } from "@/lib/place-search";
import { useVenuePortalCopy, type VenuePortalKey } from "@/lib/venue-portal-copy";
import { claimListing, fetchClaims } from "@/lib/venues";

type Claim = Awaited<ReturnType<typeof fetchClaims>>[number];

/** /business/claims: take over a restaurant or stay Mshwar's team listed, once the licence is checked. */
export function ClaimsView() {
  const copy = useVenuePortalCopy();
  const { locale } = useLocale();
  const { org } = usePortal();
  const [claims, setClaims] = React.useState<Claim[] | null>(null);
  const [place, setPlace] = React.useState<PlaceHit | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [version, setVersion] = React.useState(0);
  const orgId = org?.id ?? null;

  React.useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void fetchClaims(orgId)
      .then((next) => {
        if (!cancelled) setClaims(next);
      })
      .catch(() => {
        if (!cancelled) setClaims([]);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, version]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!orgId || !place) return;
    setBusy(true);
    setMessage(null);
    try {
      await claimListing(orgId, place.slug, note.trim());
      setMessage({ tone: "success", text: copy.claimSent });
      setPlace(null);
      setNote("");
      setVersion((value) => value + 1);
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, copy.loadError) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      <PageHeader icon={<Store aria-hidden />} title={copy.claimsTitle} description={copy.claimsBody} />
      {!orgId ? (
        <Notice>{copy.noOrg}</Notice>
      ) : (
        <form
          className="grid max-w-2xl gap-4 rounded-card border border-border-subtle bg-surface-raised p-5"
          onSubmit={(event) => void send(event)}
        >
          {place ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">
                {interpolate(copy.chosen, { place: `${place.title} · ${place.placeLabel}` })}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPlace(null)}>
                {copy.change}
              </Button>
            </div>
          ) : (
            <PlaceSearch id="claim-place" label={copy.findPlace} onPick={setPlace} />
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="claim-note">{copy.claimNote}</Label>
            <Textarea
              id="claim-note"
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          {message ? (
            <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
              {message.text}
            </Notice>
          ) : null}
          <Button type="submit" className="w-fit" disabled={busy || !place || note.trim().length < 10}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send aria-hidden />}
            {copy.sendClaim}
          </Button>
        </form>
      )}
      {orgId ? (
        <section className="grid gap-3">
          <h2 className="title-section text-[1.2rem]">{copy.yourClaims}</h2>
          {claims === null ? (
            <Loader2 className="size-5 animate-spin text-text-muted" aria-hidden />
          ) : claims.length === 0 ? (
            <p className="text-sm text-text-muted">{copy.noClaims}</p>
          ) : (
            <ul className="grid gap-2">
              {claims.map((claim) => (
                <li
                  key={claim.id}
                  className="flex flex-wrap items-center gap-3 rounded-control border border-border-subtle p-3 text-sm"
                >
                  <span className="font-medium">{claim.experience.title}</span>
                  <Badge
                    variant={
                      claim.status === "approved" ? "success" : claim.status === "rejected" ? "danger" : "warning"
                    }
                  >
                    {copy[`claim_${claim.status}` as VenuePortalKey]}
                  </Badge>
                  <span className="text-text-muted">
                    {formatDate(locale, claim.created_at, { dateStyle: "medium" })}
                  </span>
                  {claim.reason ? <span className="basis-full text-text-muted">{claim.reason}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
