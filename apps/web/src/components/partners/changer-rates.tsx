"use client";

import * as React from "react";
import { Banknote, Loader2 } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { errorText } from "@/components/partners/step";
import { isStepUpCancelled, useStepUp } from "@/components/verified/step-up";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { fetchChangerPortal, postRates, type ChangerPortal, type MyBranch } from "@/lib/exchange";
import { beirutDateTime } from "@/lib/local-time";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";
import { useNow } from "@/lib/use-now";

type Base = "USD" | "EUR";
const BASES: Base[] = ["USD", "EUR"];
type Draft = Record<Base, { buy: string; sell: string }>;

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[\s,]/g, "");
  if (!cleaned) {
    return null;
  }
  const number = Number(cleaned);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Same rules the API applies, so the form can say what is wrong before a round trip. */
export function rateProblem(buy: number | null, sell: number | null): boolean {
  if (buy === null && sell === null) {
    return false;
  }
  if (buy === null || sell === null) {
    return true;
  }
  return buy > sell || (sell - buy) / sell > 0.1;
}

function BranchRates({ branch, onPosted }: { branch: MyBranch; onPosted: (portal: ChangerPortal) => void }) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { locale } = useLocale();
  const { withStepUp, dialog } = useStepUp();
  const [draft, setDraft] = React.useState<Draft>({ USD: { buy: "", sell: "" }, EUR: { buy: "", sell: "" } });
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const parsed = BASES.map((base) => ({
    base,
    buy: parseAmount(draft[base].buy),
    sell: parseAmount(draft[base].sell),
  }));
  const invalid = parsed.some((row) => rateProblem(row.buy, row.sell));
  const rates = parsed.flatMap((row) =>
    row.buy !== null && row.sell !== null ? [{ base: row.base, buy: row.buy, sell: row.sell }] : [],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (invalid || rates.length === 0) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const next = await withStepUp(() => postRates(branch.id, rates));
      onPosted(next);
      setDraft({ USD: { buy: "", sell: "" }, EUR: { buy: "", sell: "" } });
      setMessage({ tone: "success", text: copy.ratesPosted });
    } catch (caught) {
      if (!isStepUpCancelled(caught)) {
        setMessage({ tone: "danger", text: errorText(caught, verified.loadError) });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby={`rates-${branch.id}`}
      className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
    >
      <div className="grid gap-1">
        <h2 id={`rates-${branch.id}`} className="title-section text-[1.15rem]">
          {branch.branch_name}
        </h2>
        <p className="text-sm text-text-muted">{branch.address}</p>
      </div>
      <form className="grid gap-4" onSubmit={(event) => void submit(event)} noValidate>
        {BASES.map((base) => {
          const row = parsed.find((item) => item.base === base);
          const bad = row ? rateProblem(row.buy, row.sell) : false;
          return (
            <fieldset key={base} className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-semibold">{base}</legend>
              <div className="grid gap-1.5">
                <Label htmlFor={`buy-${branch.id}-${base}`}>{interpolate(copy.buy, { base })}</Label>
                <Input
                  id={`buy-${branch.id}-${base}`}
                  inputMode="decimal"
                  dir="ltr"
                  value={draft[base].buy}
                  aria-invalid={bad || undefined}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [base]: { ...current[base], buy: event.target.value } }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`sell-${branch.id}-${base}`}>{interpolate(copy.sell, { base })}</Label>
                <Input
                  id={`sell-${branch.id}-${base}`}
                  inputMode="decimal"
                  dir="ltr"
                  value={draft[base].sell}
                  aria-invalid={bad || undefined}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [base]: { ...current[base], sell: event.target.value } }))
                  }
                />
              </div>
            </fieldset>
          );
        })}
        <p className={invalid ? "text-sm text-danger" : "text-sm text-text-muted"}>{copy.spreadHint}</p>
        {message ? (
          <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
            {message.text}
          </Notice>
        ) : null}
        <Button type="submit" className="w-fit" disabled={busy || invalid || rates.length === 0}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {copy.postRates}
        </Button>
      </form>
      {branch.recent_rates.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">{copy.recentRates}</h3>
          <ul className="grid gap-2 text-sm">
            {branch.recent_rates.map((rate) => (
              <li
                key={rate.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border-subtle px-3 py-2"
              >
                <span dir="ltr" className="font-medium tabular-nums">
                  {rate.base} {rate.buy.toLocaleString(locale)} / {rate.sell.toLocaleString(locale)}
                </span>
                <span className="text-text-muted">
                  {interpolate(copy.postedAt, { time: beirutDateTime(locale, rate.posted_at) })}
                </span>
                <Badge variant={rate.status === "live" ? "success" : rate.status === "held" ? "warning" : "outline"}>
                  {copy[`rate_${rate.status}`]}
                </Badge>
                {rate.held_reason ? <span className="basis-full text-text-muted">{rate.held_reason}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {dialog}
    </section>
  );
}

/** /exchange/rates: today's buy and sell rates per verified branch. */
export function ChangerRates() {
  const now = useNow();
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { locale } = useLocale();
  const [portal, setPortal] = React.useState<ChangerPortal | null | undefined>(undefined);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetchChangerPortal()
      .then((next) => {
        if (!cancelled) setPortal(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const header = (
    <PageHeader
      eyebrow={copy.exchangeKicker}
      icon={<Banknote aria-hidden />}
      title={copy.ratesTitle}
      description={copy.ratesBody}
    />
  );
  if (failed) {
    return (
      <div className="grid gap-6">
        {header}
        <Notice tone="danger" role="alert">
          {verified.loadError}
        </Notice>
      </div>
    );
  }
  if (portal === undefined) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  const suspended = portal?.licence?.rates_suspended_until ?? null;
  const pausedNow = suspended !== null && new Date(suspended).getTime() > now;
  const branches =
    portal && portal.status === "approved" && !pausedNow ? portal.offices.filter((office) => office.live) : [];

  return (
    <div className="grid gap-6">
      {header}
      {pausedNow && suspended ? (
        <Notice tone="warning">
          {interpolate(copy.ratesPaused, { date: formatDate(locale, suspended, { dateStyle: "medium" }) })}
        </Notice>
      ) : null}
      {branches.length === 0 ? (
        <EmptyState title={copy.noLiveBranches} description={copy.ratesNotLive} />
      ) : (
        branches.map((branch) => <BranchRates key={branch.id} branch={branch} onPosted={setPortal} />)
      )}
    </div>
  );
}
