"use client";

import * as React from "react";
import { ExternalLink, Loader2, Save } from "lucide-react";
import { useLoad } from "@/components/admin/use-load";
import { DestinationSelect } from "@/components/guide/pickers";
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
import {
  decideLead,
  fetchLeads,
  fetchPlaceTypeCoverage,
  fetchPricesDue,
  publishLead,
  recordSourcedPrice,
  type LeadStatus,
  type PlaceLead,
  type PlaceTypeCoverage,
  type SourcedPrice,
  type SourcedPriceInput,
} from "@/lib/admin-catalogue";
import { useAdminCatalogueCopy, type AdminCatalogueCopy } from "@/lib/admin-catalogue-copy";
import { beirutToday } from "@/lib/local-time";
import { formatMinor } from "@/lib/planner";

const LEAD_STATUSES: LeadStatus[] = ["new", "checking", "published", "rejected", "duplicate"];
const toMinor = (value: string) => Math.round(Number(value) * 100);

function Loading({ failed, copy }: { failed: boolean; copy: AdminCatalogueCopy }) {
  return failed ? (
    <Notice tone="danger" role="alert">
      {copy.loadError}
    </Notice>
  ) : (
    <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden />
  );
}

function useDay() {
  const { locale } = useLocale();
  return (value: string) => formatDate(locale, `${value.slice(0, 10)}T12:00:00Z`, { dateStyle: "medium" });
}

function LeadRow({ lead, names, onDone }: { lead: PlaceLead; names: Map<string, string>; onDone: () => void }) {
  const copy = useAdminCatalogueCopy();
  const [reason, setReason] = React.useState("");
  const [publishing, setPublishing] = React.useState(false);
  const [description, setDescription] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const open = lead.status === "new" || lead.status === "checking";

  async function act(task: () => Promise<unknown>, done?: (result: unknown) => string) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await task();
      if (done) setMessage({ tone: "success", text: done(result) });
      onDone();
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, copy.loadError) });
    } finally {
      setBusy(false);
    }
  }

  const id = `lead-${lead.id}`;
  return (
    <li className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <span className="font-medium">
            {lead.name}
            {lead.name_ar ? (
              <span className="ms-2 text-text-muted" dir="rtl" lang="ar">
                {lead.name_ar}
              </span>
            ) : null}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            {lead.place_type ? (
              <Badge variant="secondary">{names.get(lead.place_type) ?? lead.place_type}</Badge>
            ) : null}
            {lead.destination_slug ? <span>{lead.destination_slug}</span> : null}
            <span>{interpolate(copy.leadSource, { source: lead.source, id: lead.external_id })}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lead.demand ? <Badge variant="warning">{interpolate(copy.leadDemand, { count: lead.demand })}</Badge> : null}
          <a
            href={`https://www.openstreetmap.org/?mlat=${lead.lat}&mlon=${lead.lng}#map=18/${lead.lat}/${lead.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
          >
            <ExternalLink className="size-3.5" aria-hidden />
            {copy.leadMap}
          </a>
        </div>
      </div>
      {lead.reason ? <p className="text-sm text-text-muted">{lead.reason}</p> : null}
      {open ? (
        <div className="grid gap-3">
          <div className="grid gap-1.5 sm:max-w-md">
            <Label htmlFor={`${id}-reason`}>{copy.reasonLabel}</Label>
            <Input id={`${id}-reason`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            {lead.status === "new" ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void act(() => decideLead(lead.id, "checking", reason))}
              >
                {copy.leadCheck}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || reason.trim().length < 3}
              onClick={() => void act(() => decideLead(lead.id, "rejected", reason))}
            >
              {copy.leadReject}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void act(() => decideLead(lead.id, "duplicate", reason))}
            >
              {copy.leadDuplicate}
            </Button>
            <Button
              type="button"
              size="sm"
              aria-expanded={publishing}
              aria-controls={`${id}-publish`}
              onClick={() => setPublishing((value) => !value)}
            >
              {copy.leadPublish}
            </Button>
          </div>
          {publishing ? (
            <form
              id={`${id}-publish`}
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void act(
                  () => publishLead(lead.id, { description: description.trim(), notes: notes.trim() }),
                  (result) => interpolate(copy.publishedAs, { slug: (result as { slug: string }).slug }),
                );
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-description`}>{copy.publishDescription}</Label>
                <Textarea
                  id={`${id}-description`}
                  rows={3}
                  value={description}
                  minLength={20}
                  maxLength={4000}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`${id}-notes`}>{copy.publishNotes}</Label>
                <Textarea
                  id={`${id}-notes`}
                  rows={2}
                  value={notes}
                  minLength={10}
                  maxLength={2000}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="w-fit"
                disabled={busy || description.trim().length < 20 || notes.trim().length < 10}
              >
                {copy.publishConfirm}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {message ? (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
    </li>
  );
}

function LeadsSection({ names }: { names: Map<string, string> }) {
  const copy = useAdminCatalogueCopy();
  const [status, setStatus] = React.useState<LeadStatus>("new");
  const [destination, setDestination] = React.useState("");
  const leads = useLoad(() => fetchLeads({ status, destination }), `leads:${status}:${destination}`);
  return (
    <section className="grid gap-3" aria-labelledby="leads-heading">
      <div className="grid gap-1">
        <h2 id="leads-heading" className="font-semibold">
          {copy.leadsTitle}
        </h2>
        <p className="text-sm text-text-muted">{copy.leadsBody}</p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="leads-status">{copy.statusLabel}</Label>
          <NativeSelect
            id="leads-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
          >
            {LEAD_STATUSES.map((value) => (
              <option key={value} value={value}>
                {copy[`ls_${value}`]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="leads-destination">{copy.destinationLabel}</Label>
          <DestinationSelect
            id="leads-destination"
            value={destination}
            onChange={setDestination}
            allowAny
            anyLabel={copy.anyDestination}
          />
        </div>
      </div>
      {leads.data ? (
        leads.data.length ? (
          <ul className="grid gap-3">
            {leads.data.map((lead) => (
              <LeadRow key={lead.id} lead={lead} names={names} onDone={leads.reload} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">{copy.leadsEmpty}</p>
        )
      ) : (
        <Loading failed={leads.failed} copy={copy} />
      )}
    </section>
  );
}

function RecordPrice({ start, onSaved }: { start: SourcedPrice | null; onSaved: () => void }) {
  const copy = useAdminCatalogueCopy();
  const [listing, setListing] = React.useState(start?.experience_id ?? "");
  const [priceType, setPriceType] = React.useState<SourcedPriceInput["price_type"]>(start?.price_type ?? "fixed");
  const [amount, setAmount] = React.useState(start ? String(start.amount_minor / 100) : "");
  const [maxAmount, setMaxAmount] = React.useState(
    start?.max_amount_minor != null ? String(start.max_amount_minor / 100) : "",
  );
  const [currency, setCurrency] = React.useState(start?.currency ?? "USD");
  const [unit, setUnit] = React.useState<"person" | "group">(start?.unit ?? "person");
  const [sourceUrl, setSourceUrl] = React.useState(start?.source_url ?? "");
  const [sourceName, setSourceName] = React.useState(start?.source_name ?? "");
  const [checkedOn, setCheckedOn] = React.useState(beirutToday());
  const [reviewBy, setReviewBy] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const body: SourcedPriceInput = {
      price_type: priceType,
      amount_minor: toMinor(amount),
      ...(priceType === "range" && maxAmount ? { max_amount_minor: toMinor(maxAmount) } : {}),
      currency: currency.trim().toUpperCase(),
      unit,
      source_url: sourceUrl.trim(),
      source_name: sourceName.trim(),
      checked_on: checkedOn,
      ...(reviewBy ? { review_by: reviewBy } : {}),
      note: note.trim(),
    };
    try {
      await recordSourcedPrice(listing.trim(), body);
      setMessage({ tone: "success", text: copy.priceSaved });
      onSaved();
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, copy.loadError) });
    } finally {
      setBusy(false);
    }
  }

  const field = (key: string, label: string, input: React.ReactNode) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`price-${key}`}>{label}</Label>
      {input}
    </div>
  );
  return (
    <form className="grid gap-4 rounded-card border border-border-subtle p-4" onSubmit={(event) => void save(event)}>
      <div className="grid gap-1">
        <h3 className="font-medium">{copy.recordTitle}</h3>
        <p className="text-sm text-text-muted">{copy.recordBody}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {field(
          "listing",
          copy.listingId,
          <Input id="price-listing" dir="ltr" value={listing} onChange={(e) => setListing(e.target.value)} />,
        )}
        {field(
          "type",
          copy.priceType,
          <NativeSelect
            id="price-type"
            value={priceType}
            onChange={(event) => setPriceType(event.target.value as SourcedPriceInput["price_type"])}
          >
            <option value="fixed">{copy.pt_fixed}</option>
            <option value="from">{copy.pt_from}</option>
            <option value="range">{copy.pt_range}</option>
          </NativeSelect>,
        )}
        {field(
          "unit",
          copy.unit,
          <NativeSelect
            id="price-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value as "person" | "group")}
          >
            <option value="person">{copy.unit_person}</option>
            <option value="group">{copy.unit_group}</option>
          </NativeSelect>,
        )}
        {field(
          "amount",
          copy.amount,
          <Input
            id="price-amount"
            inputMode="decimal"
            dir="ltr"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />,
        )}
        {priceType === "range"
          ? field(
              "max",
              copy.maxAmount,
              <Input
                id="price-max"
                inputMode="decimal"
                dir="ltr"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
              />,
            )
          : null}
        {field(
          "currency",
          copy.currency,
          <Input
            id="price-currency"
            dir="ltr"
            maxLength={3}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          />,
        )}
        {field(
          "url",
          copy.sourceUrl,
          <Input
            id="price-url"
            type="url"
            dir="ltr"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />,
        )}
        {field(
          "source",
          copy.sourceName,
          <Input id="price-source" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />,
        )}
        {field(
          "checked",
          copy.checkedOn,
          <Input
            id="price-checked"
            type="date"
            dir="ltr"
            value={checkedOn}
            onChange={(e) => setCheckedOn(e.target.value)}
          />,
        )}
        {field(
          "review",
          copy.reviewBy,
          <Input
            id="price-review"
            type="date"
            dir="ltr"
            value={reviewBy}
            onChange={(e) => setReviewBy(e.target.value)}
          />,
        )}
        {field(
          "note",
          copy.note,
          <Input id="price-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />,
        )}
      </div>
      {message ? (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
      <Button
        type="submit"
        size="sm"
        className="w-fit"
        disabled={busy || !listing.trim() || !amount || !sourceUrl.trim() || !sourceName.trim()}
      >
        <Save aria-hidden />
        {copy.savePrice}
      </Button>
    </form>
  );
}

function PricesSection() {
  const copy = useAdminCatalogueCopy();
  const day = useDay();
  const due = useLoad(() => fetchPricesDue(30), "prices");
  const [start, setStart] = React.useState<SourcedPrice | null>(null);
  const amount = (price: SourcedPrice) =>
    price.price_type === "range" && price.max_amount_minor != null
      ? `${formatMinor(price.amount_minor, price.currency)} – ${formatMinor(price.max_amount_minor, price.currency)}`
      : formatMinor(price.amount_minor, price.currency);
  return (
    <section className="grid gap-3" aria-labelledby="prices-heading">
      <div className="grid gap-1">
        <h2 id="prices-heading" className="font-semibold">
          {copy.pricesTitle}
        </h2>
        <p className="text-sm text-text-muted">{copy.pricesBody}</p>
      </div>
      {due.data ? (
        due.data.length ? (
          <ul className="grid gap-2">
            {due.data.map((price) => (
              <li
                key={price.price_rule_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-sunken px-3 py-2 text-sm"
              >
                <span className="grid gap-0.5">
                  <span className="font-medium">
                    {price.title} · <span className="tabular-nums">{amount(price)}</span>
                  </span>
                  <a
                    href={price.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-muted underline underline-offset-2"
                  >
                    {price.source_name} · {interpolate(copy.priceCheckedOn, { date: day(price.checked_on) })}
                  </a>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant="warning">{interpolate(copy.priceReviewBy, { date: day(price.review_by) })}</Badge>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setStart(price)}>
                    {copy.recheck}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">{copy.pricesEmpty}</p>
        )
      ) : (
        <Loading failed={due.failed} copy={copy} />
      )}
      {/* Keyed by the price picked, so "record again" starts from it. */}
      <RecordPrice key={start?.price_rule_id ?? "new"} start={start} onSaved={due.reload} />
    </section>
  );
}

function CoverageSection({ coverage, names }: { coverage: PlaceTypeCoverage; names: Map<string, string> }) {
  const copy = useAdminCatalogueCopy();
  return (
    <section className="grid gap-3" aria-labelledby="coverage-heading">
      <div className="grid gap-1">
        <h2 id="coverage-heading" className="font-semibold">
          {copy.coverageTitle}
        </h2>
        <p className="text-sm text-text-muted">{copy.coverageBody}</p>
      </div>
      <ul className="grid gap-2">
        {coverage.destinations.map((row) => {
          const kinds = Object.entries(row.types).sort(([, a], [, b]) => b - a);
          return (
            <li key={row.slug} className="grid gap-2 rounded-control bg-surface-sunken px-3 py-2 text-sm">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{row.name}</span>
                <span className="flex items-center gap-2 text-text-muted">
                  {interpolate(copy.kindsCount, { count: kinds.length })}
                  {row.untyped ? (
                    <Badge variant="warning">
                      {copy.untyped}: {row.untyped}
                    </Badge>
                  ) : null}
                </span>
              </span>
              {kinds.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {kinds.map(([slug, count]) => (
                    <Badge key={slug} variant="secondary">
                      {names.get(slug) ?? slug} {count}
                    </Badge>
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** /admin/catalogue: leads to check, published prices to check again, and what the planner can use. */
export function CatalogueGrowthAdmin() {
  const copy = useAdminCatalogueCopy();
  const { locale } = useLocale();
  const coverage = useLoad(fetchPlaceTypeCoverage, "coverage");
  const names = React.useMemo(
    () => new Map((coverage.data?.place_types ?? []).map((type) => [type.slug, type.names[locale]])),
    [coverage.data, locale],
  );
  return (
    <div className="grid gap-8">
      <PageHeader title={copy.cgTitle} description={copy.cgBody} />
      <LeadsSection names={names} />
      <PricesSection />
      {coverage.data ? (
        <CoverageSection coverage={coverage.data} names={names} />
      ) : (
        <Loading failed={coverage.failed} copy={copy} />
      )}
    </div>
  );
}
