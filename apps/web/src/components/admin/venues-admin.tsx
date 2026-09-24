"use client";

import * as React from "react";
import { Loader2, Plus } from "lucide-react";
import { DestinationSelect, LocateButton } from "@/components/guide/pickers";
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
import { beirutToday } from "@/lib/local-time";
import { useLocalCopy, type LocalKey } from "@/lib/local-copy";
import { cn } from "@/lib/utils";
import {
  addCheckedVenue,
  checkVenue,
  decideClaim,
  fetchAdminVenues,
  fetchCoverage,
  type AdminVenue,
  type CheckedVenueInput,
  type Coverage,
  type ListingClaim,
  type StayType,
  type VerifiedLevel,
} from "@/lib/venues";

const STAY_TYPES: StayType[] = ["hotel", "guesthouse", "hostel", "apartment"];
const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function useDay() {
  const { locale } = useLocale();
  return (value: string) => formatDate(locale, `${value.slice(0, 10)}T12:00:00Z`, { dateStyle: "medium" });
}

function CoverageTable({ coverage }: { coverage: Coverage }) {
  const copy = useAdminTrustCopy();
  const cell = (value: number, target?: number) => (
    <td className={cn("px-3 py-2 text-end tabular-nums", target !== undefined && value < target && "text-warning")}>
      {target !== undefined ? `${value}/${target}` : value}
    </td>
  );
  return (
    <section className="grid gap-2">
      <h2 className="font-semibold">{copy.coverageTitle}</h2>
      <div className="overflow-x-auto rounded-card border border-border-subtle">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-surface-sunken text-text-muted">
            <tr>
              <th className="px-3 py-2 text-start font-medium">{copy.destinationLabel}</th>
              <th className="px-3 py-2 text-end font-medium">{copy.colRestaurants}</th>
              <th className="px-3 py-2 text-end font-medium">{copy.colStays}</th>
              <th className="px-3 py-2 text-end font-medium">{copy.colTransport}</th>
              <th className="px-3 py-2 text-end font-medium">{copy.colDrivers}</th>
              <th className="px-3 py-2 text-end font-medium">{copy.colChangers}</th>
            </tr>
          </thead>
          <tbody>
            {coverage.destinations.map((row) => (
              <tr key={row.slug} className="border-t border-border-subtle">
                <td className="px-3 py-2">{row.name}</td>
                {cell(row.restaurants, coverage.targets.restaurants)}
                {cell(row.stays, coverage.targets.stays)}
                {cell(row.transport_cards)}
                {cell(row.drivers)}
                {cell(row.changers)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VenueRow({ venue, onChanged }: { venue: AdminVenue; onChanged: () => void }) {
  const copy = useAdminTrustCopy();
  const day = useDay();
  const [open, setOpen] = React.useState(false);
  const [level, setLevel] = React.useState<VerifiedLevel>(
    venue.licence_number ? "licensed_claimed" : "checked_by_mshwar",
  );
  const [checkedOn, setCheckedOn] = React.useState(beirutToday());
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const v = venue.verification;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await checkVenue(venue.id, level, notes.trim(), checkedOn);
      setOpen(false);
      onChanged();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{venue.title}</span>
        <Badge variant="secondary">
          {copy[`kind_${venue.kind === "hotel" ? "hotel" : "restaurant"}` as AdminTrustKey]}
        </Badge>
        {v.level ? (
          <Badge variant="success">{copy[`level_${v.level}` as AdminTrustKey]}</Badge>
        ) : (
          <Badge variant="warning">{copy.notChecked}</Badge>
        )}
        <span className="text-text-muted">
          {venue.destination} · {interpolate(copy.runBy, { owner: venue.owner })}
        </span>
      </div>
      {v.checked_on && v.review_by ? (
        <p className="text-text-muted">
          {interpolate(copy.checkedUntil, { date: day(v.checked_on), due: day(v.review_by) })}
        </p>
      ) : null}
      {venue.licence_number ? (
        <p className="text-text-muted">
          {venue.licence_number} · {venue.licence_authority}
          {venue.licence_expires_on ? ` · ${day(venue.licence_expires_on)}` : ""}
        </p>
      ) : null}
      {venue.check_notes ? <p className="text-text-muted">{venue.check_notes}</p> : null}
      {open ? (
        <form className="grid gap-3 rounded-control bg-surface-sunken p-3" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`level-${venue.id}`}>{copy.levelLabel}</Label>
              <NativeSelect
                id={`level-${venue.id}`}
                value={level}
                onChange={(event) => setLevel(event.target.value as VerifiedLevel)}
              >
                <option value="checked_by_mshwar">{copy.level_checked_by_mshwar}</option>
                <option value="licensed_claimed" disabled={!venue.licence_number}>
                  {copy.level_licensed_claimed}
                </option>
              </NativeSelect>
              {!venue.licence_number ? <p className="text-xs text-text-muted">{copy.licenceMissing}</p> : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`on-${venue.id}`}>{copy.checkedOnDate}</Label>
              <Input
                id={`on-${venue.id}`}
                type="date"
                max={beirutToday()}
                value={checkedOn}
                onChange={(event) => setCheckedOn(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`notes-${venue.id}`}>{copy.venueNotes}</Label>
            <Textarea
              id={`notes-${venue.id}`}
              rows={2}
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
              {copy.recordVenueCheck}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>
          {copy.recordVenueCheck}
        </Button>
      )}
    </li>
  );
}

function AddVisitedVenue({ onAdded }: { onAdded: () => void }) {
  const copy = useAdminTrustCopy();
  const local = useLocalCopy();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<"restaurant" | "hotel">("restaurant");
  const [form, setForm] = React.useState({
    name: "",
    description: "",
    destination: "",
    address: "",
    lat: "",
    lng: "",
    notes: "",
    cuisines: "",
    price_level: "",
    reservation_phone: "",
    stay_type: "guesthouse" as StayType,
    stars: "",
    price_from: "",
    booking_url: "",
    amenities: "",
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const base: CheckedVenueInput = {
      listing_kind: kind,
      name: form.name.trim(),
      description: form.description.trim(),
      destination: form.destination,
      address: form.address.trim(),
      lat: Number(form.lat),
      lng: Number(form.lng),
      notes: form.notes.trim(),
      reservation_phone: form.reservation_phone.trim(),
    };
    const input: CheckedVenueInput =
      kind === "restaurant"
        ? { ...base, cuisines: list(form.cuisines), price_level: form.price_level ? Number(form.price_level) : null }
        : {
            ...base,
            stay_type: form.stay_type,
            stars: form.stars ? Number(form.stars) : null,
            price_from_minor: form.price_from ? Math.round(Number(form.price_from) * 100) : null,
            booking_url: form.booking_url.trim(),
            amenities: list(form.amenities),
          };
    try {
      await addCheckedVenue(input);
      setDone(true);
      setOpen(false);
      onAdded();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`venue-${key}`}>{label}</Label>
      <Input id={`venue-${key}`} value={form[key]} onChange={(event) => set(key, event.target.value)} {...props} />
    </div>
  );
  const ready =
    form.name.trim().length >= 3 &&
    form.description.trim().length >= 20 &&
    form.destination !== "" &&
    form.lat !== "" &&
    form.lng !== "" &&
    Number.isFinite(Number(form.lat)) &&
    Number.isFinite(Number(form.lng)) &&
    form.notes.trim().length >= 10;

  return (
    <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{copy.addVisitedTitle}</h2>
        {open ? null : (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus aria-hidden />
            {copy.addVenue}
          </Button>
        )}
      </div>
      {done && !open ? (
        <Notice tone="success" role="status">
          {copy.venueAdded}
        </Notice>
      ) : null}
      {open ? (
        <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="venue-kind">{copy.kindLabel}</Label>
              <NativeSelect
                id="venue-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
              >
                <option value="restaurant">{copy.kind_restaurant}</option>
                <option value="hotel">{copy.kind_hotel}</option>
              </NativeSelect>
            </div>
            {field("name", copy.nameLabel, { maxLength: 120, required: true })}
            <div className="grid gap-1.5">
              <Label htmlFor="venue-destination">{copy.destinationLabel}</Label>
              <DestinationSelect
                id="venue-destination"
                value={form.destination}
                onChange={(slug) => set("destination", slug)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="venue-description">{copy.descriptionLabel}</Label>
            <Textarea
              id="venue-description"
              rows={3}
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("address", copy.addressLabel)}
            {field("lat", copy.latLabel, { inputMode: "decimal", dir: "ltr" })}
            {field("lng", copy.lngLabel, { inputMode: "decimal", dir: "ltr" })}
          </div>
          <LocateButton
            onLocate={(lat, lng) => setForm((current) => ({ ...current, lat: String(lat), lng: String(lng) }))}
          />
          {kind === "restaurant" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {field("cuisines", copy.cuisinesLabel)}
              {field("price_level", copy.priceLevelLabel, { type: "number", min: 1, max: 4 })}
              {field("reservation_phone", copy.phoneLabel, { type: "tel", dir: "ltr" })}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="venue-stay-type">{copy.stayTypeLabel}</Label>
                <NativeSelect
                  id="venue-stay-type"
                  value={form.stay_type}
                  onChange={(event) => set("stay_type", event.target.value)}
                >
                  {STAY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {local[`stay_${type}` as LocalKey]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {field("stars", copy.starsLabel, { type: "number", min: 1, max: 5 })}
              {field("price_from", copy.priceFromLabel, { inputMode: "decimal", dir: "ltr" })}
              {field("reservation_phone", copy.phoneLabel, { type: "tel", dir: "ltr" })}
              {field("booking_url", copy.bookingUrlLabel, { type: "url", dir: "ltr" })}
              {field("amenities", copy.amenitiesLabel)}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="venue-notes">{copy.venueNotes}</Label>
            <Textarea
              id="venue-notes"
              rows={2}
              value={form.notes}
              onChange={(event) => set("notes", event.target.value)}
            />
          </div>
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !ready}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {copy.addVenue}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ClaimRow({ claim, onDone }: { claim: ListingClaim; onDone: () => void }) {
  const copy = useAdminTrustCopy();
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    try {
      await decideClaim(claim.id, decision, reason.trim());
      onDone();
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-4 text-sm">
      <p className="font-medium">
        {interpolate(copy.claimBy, {
          org: claim.organization.name,
          status: claim.organization.verification,
          place: claim.experience.title,
        })}
      </p>
      {claim.note ? <p className="text-text-muted">{claim.note}</p> : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`claim-${claim.id}`}>{copy.claimReason}</Label>
        <Input id={`claim-${claim.id}`} value={reason} onChange={(event) => setReason(event.target.value)} />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void decide("approved")}>
          {copy.approveClaim}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || reason.trim().length < 3}
          onClick={() => void decide("rejected")}
        >
          {copy.rejectClaim}
        </Button>
      </div>
    </li>
  );
}

/** /admin/venues: coverage against targets, checks due, places we visited, and ownership claims. */
export function VenuesAdmin() {
  const copy = useAdminTrustCopy();
  const [destination, setDestination] = React.useState("");
  const [kind, setKind] = React.useState<"" | "restaurant" | "hotel">("");
  const [due, setDue] = React.useState(false);
  const [coverage, setCoverage] = React.useState<Coverage | null>(null);
  const [data, setData] = React.useState<{ key: string; venues: AdminVenue[]; claims: ListingClaim[] } | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [version, setVersion] = React.useState(0);
  const key = `${destination}:${kind}:${due}:${version}`;

  React.useEffect(() => {
    let cancelled = false;
    void fetchCoverage()
      .then((next) => {
        if (!cancelled) setCoverage(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [version]);

  React.useEffect(() => {
    let cancelled = false;
    void fetchAdminVenues({ destination: destination || undefined, kind: kind || undefined, due })
      .then((next) => {
        if (!cancelled) {
          setData({ key, ...next });
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [destination, kind, due, key]);

  const reload = () => setVersion((value) => value + 1);
  const current = data?.key === key ? data : null;

  return (
    <div className="grid gap-6">
      <PageHeader title={copy.vnTitle} description={copy.vnBody} />
      {coverage ? <CoverageTable coverage={coverage} /> : null}
      <AddVisitedVenue onAdded={reload} />
      {current?.claims.length ? (
        <section className="grid gap-3">
          <h2 className="font-semibold">{copy.claimsTitle}</h2>
          <ul className="grid gap-3">
            {current.claims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} onDone={reload} />
            ))}
          </ul>
        </section>
      ) : null}
      <section className="grid gap-3">
        <h2 className="font-semibold">{copy.venuesTitle}</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="vn-destination">{copy.destinationLabel}</Label>
            <DestinationSelect
              id="vn-destination"
              value={destination}
              onChange={setDestination}
              allowAny
              anyLabel={copy.anyDestination}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="vn-kind">{copy.kindLabel}</Label>
            <NativeSelect id="vn-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              <option value="">{copy.all}</option>
              <option value="restaurant">{copy.kind_restaurant}</option>
              <option value="hotel">{copy.kind_hotel}</option>
            </NativeSelect>
          </div>
          <label className="inline-flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" checked={due} onChange={(event) => setDue(event.target.checked)} />
            {copy.dueOnly}
          </label>
        </div>
        {failed ? (
          <Notice tone="danger" role="alert">
            {copy.loadError}
          </Notice>
        ) : !current ? (
          <Loader2 className="size-6 animate-spin text-text-muted" aria-hidden />
        ) : current.venues.length === 0 ? (
          <p className="text-sm text-text-muted">{copy.noVenues}</p>
        ) : (
          <ul className="grid gap-3">
            {current.venues.map((venue) => (
              <VenueRow key={venue.id} venue={venue} onChanged={reload} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
