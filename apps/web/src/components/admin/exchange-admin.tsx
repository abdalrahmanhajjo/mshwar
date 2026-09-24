"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { useAdminTrustCopy, type AdminTrustKey } from "@/lib/admin-trust-copy";
import {
  decideRate,
  fetchRegisterStatus,
  loadRegister,
  parseRegister,
  verifyBranch,
  type RegisterDiff,
  type RegisterStatus,
} from "@/lib/exchange";
import { beirutDateTime, beirutToday } from "@/lib/local-time";
import { useNow } from "@/lib/use-now";

type Licence = RegisterStatus["licences"][number];
type Office = NonNullable<Licence["offices"]>[number];

function useDay() {
  const { locale } = useLocale();
  return (value: string) =>
    formatDate(locale, value.length === 10 ? `${value}T12:00:00Z` : value, { dateStyle: "medium" });
}

function RegisterLoader({ onLoaded }: { onLoaded: () => void }) {
  const copy = useAdminTrustCopy();
  const [publishedOn, setPublishedOn] = React.useState(beirutToday());
  const [sourceUrl, setSourceUrl] = React.useState("");
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [diff, setDiff] = React.useState<RegisterDiff | null>(null);
  const parsed = React.useMemo(() => parseRegister(text), [text]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setDiff(await loadRegister(publishedOn, sourceUrl.trim(), parsed.entries));
      setText("");
      onLoaded();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
      <h2 className="font-semibold">{copy.loadTitle}</h2>
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="grid gap-1.5">
            <Label htmlFor="bdl-date">{copy.publishedOn}</Label>
            <Input
              id="bdl-date"
              type="date"
              max={beirutToday()}
              value={publishedOn}
              onChange={(event) => setPublishedOn(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bdl-source">{copy.sourceUrl}</Label>
            <Input
              id="bdl-source"
              type="url"
              dir="ltr"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bdl-paste">{copy.pasteLabel}</Label>
          <Textarea
            id="bdl-paste"
            rows={8}
            dir="ltr"
            className="font-mono text-xs"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          {text ? (
            <p className="text-sm text-text-muted">
              {interpolate(copy.parsed, { n: String(parsed.entries.length) })}
              {parsed.errors.length ? (
                <span className="ms-2 text-danger">
                  {interpolate(copy.parseErrors, { lines: parsed.errors.slice(0, 10).join(", ") })}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {error ? (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        ) : null}
        <Button
          type="submit"
          className="w-fit"
          disabled={busy || parsed.entries.length === 0 || parsed.errors.length > 0 || !sourceUrl}
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload aria-hidden />}
          {copy.loadButton}
        </Button>
      </form>
      {diff ? (
        <div className="grid gap-2 text-sm">
          <Notice tone="success" role="status">
            {interpolate(copy.diffMatched, { n: String(diff.matched) })}
          </Notice>
          {diff.missing.length ? (
            <div>
              <p className="font-medium text-danger">{copy.diffMissing}</p>
              <ul className="list-inside list-disc text-text-muted">
                {diff.missing.map((row) => (
                  <li key={row.partner_id}>
                    {row.display_name} · {row.bdl_number}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {diff.category_changed.length ? (
            <div>
              <p className="font-medium text-warning">{copy.diffCategory}</p>
              <ul className="list-inside list-disc text-text-muted">
                {diff.category_changed.map((row) => (
                  <li key={row.partner_id}>
                    {row.display_name} · {row.bdl_number} → {row.listed_category}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function BranchCheck({ office, onDone }: { office: Office; onDone: () => void }) {
  const copy = useAdminTrustCopy();
  const day = useDay();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"visit" | "video_call">("visit");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyBranch(office.id, kind, notes.trim());
      setOpen(false);
      onDone();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 rounded-control border border-border-subtle p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{office.branch_name}</span> · {office.address}
        </span>
        <Badge variant={office.verified ? "success" : "warning"}>
          {office.verified && office.verified_at
            ? interpolate(copy.branchChecked, { date: day(office.verified_at) })
            : copy.branchNotChecked}
        </Badge>
      </div>
      {open ? (
        <form className="grid gap-2" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <NativeSelect
              aria-label={copy.kindLabel}
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
            >
              <option value="visit">{copy.check_visit}</option>
              <option value="video_call">{copy.check_video_call}</option>
            </NativeSelect>
            <Input
              aria-label={copy.checkNotes}
              placeholder={copy.checkNotes}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || notes.trim().length < 10}>
              {copy.recordCheck}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>
          {copy.recordBranchCheck}
        </Button>
      )}
    </li>
  );
}

/** /admin/exchange: this month's BDL list, held rates, and every licence with its branches. */
export function ExchangeAdmin() {
  const now = useNow();
  const copy = useAdminTrustCopy();
  const { locale } = useLocale();
  const day = useDay();
  const [status, setStatus] = React.useState<RegisterStatus | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetchRegisterStatus()
      .then((next) => {
        if (!cancelled) setStatus(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = () => setVersion((value) => value + 1);

  async function rate(id: string, decision: "live" | "rejected") {
    setError(null);
    try {
      await decideRate(id, decision);
      reload();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader title={copy.exTitle} description={copy.exBody} />
      {failed ? (
        <Notice tone="danger" role="alert">
          {copy.loadError}
        </Notice>
      ) : !status ? (
        <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden />
      ) : (
        <>
          {status.latest ? (
            <Notice tone={status.overdue ? "warning" : "info"}>
              {interpolate(copy.registerLatest, {
                date: day(status.latest.published_on),
                n: String(status.latest.entries),
                loaded: beirutDateTime(locale, status.latest.loaded_at),
              })}
              {status.overdue ? ` ${copy.registerOverdue}` : ""}
            </Notice>
          ) : (
            <Notice tone="warning">{copy.registerNone}</Notice>
          )}
          <RegisterLoader onLoaded={reload} />

          <section className="grid gap-3">
            <h2 className="font-semibold">{copy.heldTitle}</h2>
            {error ? (
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
            ) : null}
            {status.held_rates.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.heldEmpty}</p>
            ) : (
              <ul className="grid gap-2">
                {status.held_rates.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 rounded-control border border-border-subtle p-3 text-sm"
                  >
                    <span className="font-medium">
                      {row.changer} · {row.office}
                    </span>
                    <span dir="ltr" className="tabular-nums">
                      {row.base} {row.buy.toLocaleString(locale)} / {row.sell.toLocaleString(locale)}
                    </span>
                    <span className="text-text-muted">{beirutDateTime(locale, row.posted_at)}</span>
                    {row.held_reason ? <span className="text-text-muted">{row.held_reason}</span> : null}
                    <span className="ms-auto flex gap-2">
                      <Button type="button" size="sm" onClick={() => void rate(row.id, "live")}>
                        {copy.showRate}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void rate(row.id, "rejected")}>
                        {copy.rejectRate}
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-3">
            <h2 className="font-semibold">{copy.licencesTitle}</h2>
            {status.licences.length === 0 ? (
              <p className="text-sm text-text-muted">{copy.licencesEmpty}</p>
            ) : (
              <ul className="grid gap-4">
                {status.licences.map((licence) => (
                  <li
                    key={licence.partner_id}
                    className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{licence.display_name}</span>
                      <Badge variant="outline">{copy[`st_${licence.status}` as AdminTrustKey] ?? licence.status}</Badge>
                      <Badge variant={licence.register_status === "matched" ? "success" : "warning"}>
                        {copy[`reg_${licence.register_status}` as AdminTrustKey] ?? licence.register_status}
                      </Badge>
                      <span className="text-sm text-text-muted" dir="ltr">
                        BDL {licence.bdl_number} · {licence.category}
                      </span>
                      {licence.rates_suspended_until && new Date(licence.rates_suspended_until).getTime() > now ? (
                        <Badge variant="danger">
                          {interpolate(copy.pausedUntil, { date: day(licence.rates_suspended_until) })}
                        </Badge>
                      ) : null}
                    </div>
                    {licence.offices?.length ? (
                      <ul className="grid gap-2">
                        {licence.offices.map((office) => (
                          <BranchCheck key={office.id} office={office} onDone={reload} />
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
