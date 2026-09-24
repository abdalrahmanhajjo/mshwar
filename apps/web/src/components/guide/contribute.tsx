"use client";

import * as React from "react";
import { ExternalLink, ImagePlus, Loader2, MapPin, MapPinned, Plus, Send, Trash2 } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuideTransport } from "@/components/transport/guide-transport";
import { Textarea } from "@/components/ui/textarea";
import { ApprovedGuide } from "@/components/guide/guide-provider";
import { PlaceSearch } from "@/components/guide/place-search";
import { DestinationSelect, ListSearch, LocateButton, PinSummary } from "@/components/guide/pickers";
import { interpolate } from "@/i18n/catalogues";
import { ApiError } from "@/lib/api/client";
import { useContributeCopy, type ContributeCopy, type ContributeKey } from "@/lib/contribute-copy";
import {
  addProposalPhoto,
  compactPlace,
  fetchMyProposals,
  submitProposal,
  withdrawProposal,
  type PlaceProposal,
  type ProposalAllowance,
  type ProposalKind,
  type ProposalStatus,
} from "@/lib/guide-contribute";
import { matchesQuery, type PlaceHit } from "@/lib/place-search";
import { fileToBase64 } from "@/lib/portal";
import { useSearchCopy } from "@/lib/search-copy";

// The catalogue's categories. The server checks them (and the destination) again.
export const PROPOSAL_CATEGORIES = [
  "adventure",
  "city",
  "coast",
  "culture",
  "food",
  "heritage",
  "nature",
  "wellness",
  "workshop",
] as const;

export function categoryLabel(slug: string, copy: ContributeCopy): string {
  const key = `cat${slug.charAt(0).toUpperCase()}${slug.slice(1)}` as ContributeKey;
  return copy[key] ?? slug;
}

export function proposalStatusLabel(status: ProposalStatus, copy: ContributeCopy): string {
  return {
    submitted: copy.statusSubmitted,
    accepted: copy.statusAccepted,
    rejected: copy.statusRejected,
    withdrawn: copy.statusWithdrawn,
  }[status];
}

function EvidenceFields({ urls, onChange }: { urls: string[]; onChange: (next: string[]) => void }) {
  const copy = useContributeCopy();
  return (
    <fieldset className="grid min-w-0 grid-cols-1 gap-2">
      <legend className="pb-1 text-sm font-medium">{copy.evidence}</legend>
      <p className="text-xs text-text-muted">{copy.evidenceHint}</p>
      {urls.map((url, index) => (
        <div key={index} className="flex gap-2">
          <Input
            type="url"
            inputMode="url"
            aria-label={`${copy.evidence} ${index + 1}`}
            placeholder="https://"
            value={url}
            onChange={(event) => onChange(urls.map((item, at) => (at === index ? event.target.value : item)))}
          />
          {urls.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`${copy.withdraw} ${index + 1}`}
              onClick={() => onChange(urls.filter((_, at) => at !== index))}
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </div>
      ))}
      {urls.length < 5 ? (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...urls, ""])}>
          <Plus aria-hidden />
          {copy.addEvidence}
        </Button>
      ) : null}
    </fieldset>
  );
}

function ChosenPlace({ place, onChange }: { place: PlaceHit; onChange: () => void }) {
  const search = useSearchCopy();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-brand bg-brand-subtle px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        <MapPin className="size-4 shrink-0" aria-hidden />
        <span className="grid min-w-0">
          <span className="truncate font-medium">{interpolate(search.placeChosen, { title: place.title })}</span>
          {place.placeLabel ? <span className="truncate text-xs text-text-muted">{place.placeLabel}</span> : null}
        </span>
      </span>
      <Button type="button" size="sm" variant="ghost" onClick={onChange}>
        {search.placeChange}
      </Button>
    </div>
  );
}

function ProposalForm({ onSent }: { onSent: (proposal: PlaceProposal) => void }) {
  const copy = useContributeCopy();
  const [target, setTarget] = React.useState<PlaceHit | null>(null);
  const [kind, setKind] = React.useState<ProposalKind>("new");
  const [fields, setFields] = React.useState<Record<string, string>>({
    category: "heritage",
    destination_slug: "beirut",
    suggested_minutes: "60",
  });
  const [freeEntry, setFreeEntry] = React.useState(false);
  const [closed, setClosed] = React.useState(false);
  const [evidence, setEvidence] = React.useState<string[]>([""]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const field = (name: string) => ({
    value: fields[name] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setFields((prev) => ({ ...prev, [name]: event.target.value })),
  });
  const number = (name: string) => (fields[name] ? Number(fields[name]) : undefined);
  const setPin = (lat: number, lng: number) => setFields((prev) => ({ ...prev, lat: String(lat), lng: String(lng) }));
  const pinLat = Number(fields.lat);
  const pinLng = Number(fields.lng);
  const pinShown = Boolean(fields.lat && fields.lng) && Number.isFinite(pinLat) && Number.isFinite(pinLng);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const place =
      kind === "new"
        ? compactPlace({
            name: fields.name?.trim(),
            description: fields.description?.trim(),
            category: fields.category,
            destination_slug: fields.destination_slug,
            address: fields.address?.trim(),
            lat: number("lat"),
            lng: number("lng"),
            suggested_minutes: number("suggested_minutes"),
            free_entry: freeEntry || undefined,
          })
        : compactPlace({
            title: fields.title?.trim(),
            description: fields.description?.trim(),
            address: fields.address?.trim(),
            lat: number("lat"),
            lng: number("lng"),
            closed: closed || undefined,
            note: fields.note?.trim(),
          });
    try {
      onSent(
        await submitProposal({
          kind,
          target_slug: kind === "correction" ? target?.slug : undefined,
          place,
          evidence_urls: evidence.map((url) => url.trim()).filter(Boolean),
        }),
      );
      setFields({ category: "heritage", destination_slug: "beirut", suggested_minutes: "60" });
      setEvidence([""]);
      setTarget(null);
      setFreeEntry(false);
      setClosed(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
      aria-label={kind === "new" ? copy.tabNew : copy.tabCorrection}
    >
      <Tabs value={kind} onValueChange={(value) => setKind(value as ProposalKind)}>
        <TabsList>
          <TabsTrigger value="new">{copy.tabNew}</TabsTrigger>
          <TabsTrigger value="correction">{copy.tabCorrection}</TabsTrigger>
        </TabsList>
      </Tabs>

      {kind === "new" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="p-name">{copy.name}</Label>
            <Input id="p-name" required minLength={3} {...field("name")} />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="p-description">{copy.description}</Label>
            <Textarea id="p-description" required minLength={20} rows={4} {...field("description")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-category">{copy.category}</Label>
            <NativeSelect id="p-category" {...field("category")}>
              {PROPOSAL_CATEGORIES.map((slug) => (
                <option key={slug} value={slug}>
                  {categoryLabel(slug, copy)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-destination">{copy.destination}</Label>
            <DestinationSelect
              id="p-destination"
              value={fields.destination_slug ?? ""}
              onChange={(slug) => setFields((prev) => ({ ...prev, destination_slug: slug }))}
            />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="p-address">{copy.address}</Label>
            <Input id="p-address" {...field("address")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-lat">{copy.lat}</Label>
            <Input id="p-lat" inputMode="decimal" required placeholder="33.89" {...field("lat")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-lng">{copy.lng}</Label>
            <Input id="p-lng" inputMode="decimal" required placeholder="35.50" {...field("lng")} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            {pinShown ? <PinSummary lat={pinLat} lng={pinLng} /> : null}
            <LocateButton onLocate={setPin} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-minutes">{copy.minutes}</Label>
            <Input id="p-minutes" type="number" min={15} max={600} {...field("suggested_minutes")} />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={freeEntry} onChange={(event) => setFreeEntry(event.target.checked)} />
            {copy.freeEntry}
          </label>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-1.5 md:col-span-2">
            {target ? (
              <>
                <span className="text-sm font-medium">{copy.target}</span>
                <ChosenPlace place={target} onChange={() => setTarget(null)} />
              </>
            ) : (
              <PlaceSearch id="p-target" label={copy.target} onPick={setTarget} />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-title">{copy.newTitle}</Label>
            <Input id="p-title" {...field("title")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-address">{copy.address}</Label>
            <Input id="p-address" {...field("address")} />
          </div>
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="p-description">{copy.newDescription}</Label>
            <Textarea id="p-description" rows={3} {...field("description")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-lat">{copy.lat}</Label>
            <Input id="p-lat" inputMode="decimal" {...field("lat")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-lng">{copy.lng}</Label>
            <Input id="p-lng" inputMode="decimal" {...field("lng")} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            {pinShown ? <PinSummary lat={pinLat} lng={pinLng} /> : null}
            <LocateButton onLocate={setPin} />
          </div>
          <label className="flex items-center gap-2 text-sm md:col-span-2">
            <input type="checkbox" checked={closed} onChange={(event) => setClosed(event.target.checked)} />
            {copy.closed}
          </label>
          <div className="grid gap-1.5 md:col-span-2">
            <Label htmlFor="p-note">{copy.note}</Label>
            <Textarea id="p-note" rows={2} {...field("note")} />
          </div>
        </div>
      )}

      <EvidenceFields urls={evidence} onChange={setEvidence} />
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Button type="submit" className="w-fit" disabled={pending || (kind === "correction" && !target)}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {pending ? copy.sending : copy.submit}
      </Button>
    </form>
  );
}

function PhotoPanel({ proposal, onChanged }: { proposal: PlaceProposal; onChanged: (next: PlaceProposal) => void }) {
  const copy = useContributeCopy();
  const [granted, setGranted] = React.useState(false);
  const [alt, setAlt] = React.useState("");
  const [commons, setCommons] = React.useState({ page: "", image: "", license: "", author: "" });
  const [busy, setBusy] = React.useState<null | "own" | "commons">(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(kind: "own" | "commons", task: () => Promise<PlaceProposal>) {
    setBusy(kind);
    setError(null);
    try {
      onChanged(await task());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setBusy(null);
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await run("own", async () =>
      addProposalPhoto(proposal.id, {
        filename: file.name,
        content_type: file.type || "image/jpeg",
        content_base64: await fileToBase64(file),
        rights_granted: granted,
        alt_text: alt.trim(),
      }),
    );
  }

  return (
    <div className="grid gap-4 border-t border-border-subtle pt-4">
      <h3 className="font-medium">{copy.photosTitle}</h3>
      {proposal.photos.length ? (
        <ul className="flex flex-wrap gap-3">
          {proposal.photos.map((photo) => (
            <li key={photo.id} className="grid w-32 gap-1 text-xs text-text-muted">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed or external URL, not an optimisable asset
                <img src={photo.url} alt={photo.alt_text} className="aspect-square w-32 rounded-control object-cover" />
              ) : null}
              <span>{photo.license}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-1.5 sm:max-w-md">
        <Label htmlFor={`alt-${proposal.id}`}>{copy.alt}</Label>
        <Input id={`alt-${proposal.id}`} value={alt} onChange={(event) => setAlt(event.target.value)} />
      </div>
      <fieldset className="grid min-w-0 grid-cols-1 gap-2 rounded-control border border-border-subtle p-3">
        <legend className="px-1 text-sm font-medium">{copy.photoOwn}</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={granted} onChange={(event) => setGranted(event.target.checked)} />
          {copy.photoGrant}
        </label>
        <Button asChild type="button" variant="outline" size="sm" className="w-fit" disabled={!granted}>
          <label className={granted ? "cursor-pointer" : "pointer-events-none opacity-50"}>
            {busy === "own" ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
            {copy.photoUpload}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={!granted}
              onChange={(event) => void onFile(event)}
            />
          </label>
        </Button>
      </fieldset>
      <fieldset className="grid min-w-0 grid-cols-1 gap-2 rounded-control border border-border-subtle p-3">
        <legend className="px-1 text-sm font-medium">{copy.photoCommons}</legend>
        <Input
          aria-label={copy.commonsPage}
          placeholder={copy.commonsPage}
          value={commons.page}
          onChange={(event) => setCommons({ ...commons, page: event.target.value })}
        />
        <Input
          aria-label={copy.commonsImage}
          placeholder={copy.commonsImage}
          value={commons.image}
          onChange={(event) => setCommons({ ...commons, image: event.target.value })}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label={copy.commonsLicense}
            placeholder={copy.commonsLicense}
            value={commons.license}
            onChange={(event) => setCommons({ ...commons, license: event.target.value })}
          />
          <Input
            aria-label={copy.commonsAuthor}
            placeholder={copy.commonsAuthor}
            value={commons.author}
            onChange={(event) => setCommons({ ...commons, author: event.target.value })}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={busy !== null || !commons.page || !commons.image || !commons.license}
          onClick={() =>
            void run("commons", () =>
              addProposalPhoto(proposal.id, {
                commons_page_url: commons.page.trim(),
                commons_image_url: commons.image.trim(),
                license: commons.license.trim(),
                attribution: commons.author.trim(),
                alt_text: alt.trim(),
              }),
            )
          }
        >
          {busy === "commons" ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          {copy.commonsAdd}
        </Button>
      </fieldset>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}

function ProposalRow({
  proposal,
  open,
  onToggle,
  onChanged,
}: {
  proposal: PlaceProposal;
  open: boolean;
  onToggle: () => void;
  onChanged: (next: PlaceProposal) => void;
}) {
  const copy = useContributeCopy();
  const title =
    proposal.kind === "new" ? (proposal.payload.name ?? "") : (proposal.target?.title ?? proposal.payload.title ?? "");
  const tone = proposal.status === "accepted" ? "success" : proposal.status === "rejected" ? "danger" : "secondary";

  return (
    <li className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="grid gap-1">
          <span className="font-medium">{title}</span>
          <span className="text-xs text-text-muted">
            {proposal.kind === "new" ? copy.kindNew : copy.kindCorrection} ·{" "}
            {proposal.evidence_urls.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="me-2 underline">
                <ExternalLink className="inline size-3" aria-hidden /> {new URL(url).hostname}
              </a>
            ))}
          </span>
        </span>
        <Badge variant={tone}>{proposalStatusLabel(proposal.status, copy)}</Badge>
      </div>
      {proposal.reason && proposal.status !== "submitted" ? (
        <p className="text-sm text-text-muted">{interpolate(copy.reason, { reason: proposal.reason })}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {proposal.status === "accepted" && proposal.resulting_slug ? (
          <Button asChild size="sm" variant="outline">
            <LocaleLink href={`/experiences/${proposal.resulting_slug}`}>{copy.viewPlace}</LocaleLink>
          </Button>
        ) : null}
        {proposal.status === "submitted" ? (
          <>
            <Button type="button" size="sm" variant="outline" onClick={onToggle}>
              <ImagePlus aria-hidden />
              {copy.addPhotos}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void withdrawProposal(proposal.id).then(onChanged)}
            >
              {copy.withdraw}
            </Button>
          </>
        ) : null}
      </div>
      {open && proposal.status === "submitted" ? <PhotoPanel proposal={proposal} onChanged={onChanged} /> : null}
    </li>
  );
}

function proposalMatches(proposal: PlaceProposal, query: string): boolean {
  return matchesQuery(query, proposal.payload.name, proposal.payload.title, proposal.target?.title);
}

function Contribute() {
  const copy = useContributeCopy();
  const [allowance, setAllowance] = React.useState<ProposalAllowance | null>(null);
  const [proposals, setProposals] = React.useState<PlaceProposal[] | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const search = useSearchCopy();

  React.useEffect(() => {
    let cancelled = false;
    void fetchMyProposals()
      .then((body) => {
        if (!cancelled) {
          setAllowance(body.allowance);
          setProposals(body.proposals);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const shownProposals = (proposals ?? []).filter((proposal) => proposalMatches(proposal, query));
  const replace = (next: PlaceProposal) =>
    setProposals((prev) => (prev ?? []).map((row) => (row.id === next.id ? next : row)));

  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={copy.kicker} icon={<MapPinned aria-hidden />} title={copy.title} description={copy.body} />
      {allowance ? (
        <Notice tone={allowance.remaining > 0 ? "info" : "warning"}>
          {interpolate(copy.allowance, { remaining: String(allowance.remaining), cap: String(allowance.daily_cap) })}{" "}
          {copy.allowanceHint}
        </Notice>
      ) : null}
      {sent ? (
        <Notice tone="success" role="status">
          {copy.sent}
        </Notice>
      ) : null}
      <ProposalForm
        onSent={(proposal) => {
          setSent(true);
          setOpenId(proposal.id);
          setVersion((value) => value + 1);
        }}
      />
      <section className="grid gap-3" aria-labelledby="my-proposals">
        <h2 id="my-proposals" className="title-section text-[1.2rem]">
          {copy.mineTitle}
        </h2>
        {failed ? (
          <Notice tone="danger" role="alert">
            {copy.loadError}
          </Notice>
        ) : proposals === null ? (
          <div className="grid place-items-center py-10 text-text-muted">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </div>
        ) : proposals.length === 0 ? (
          <EmptyState icon={<MapPinned aria-hidden />} title={copy.mineEmpty} />
        ) : (
          <>
            {proposals.length > 3 ? (
              <ListSearch
                value={query}
                onChange={setQuery}
                placeholder={search.proposalSearch}
                shown={shownProposals.length}
                total={proposals.length}
              />
            ) : null}
            {shownProposals.length === 0 ? <p className="text-sm text-text-muted">{search.noResults}</p> : null}
            <ul className="grid gap-3">
              {shownProposals.map((proposal) => (
                <ProposalRow
                  key={proposal.id}
                  proposal={proposal}
                  open={openId === proposal.id}
                  onToggle={() => setOpenId((current) => (current === proposal.id ? null : proposal.id))}
                  onChanged={replace}
                />
              ))}
            </ul>
          </>
        )}
      </section>
      <GuideTransport />
    </div>
  );
}

/** /guide/contribute: propose new places and corrections, with sources and photos. */
export function GuideContribute() {
  return <ApprovedGuide>{() => <Contribute />}</ApprovedGuide>;
}
