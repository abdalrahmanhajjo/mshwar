"use client";

import * as React from "react";
import { Loader2, MapPin, Plus } from "lucide-react";
import { DestinationSelect, LocateButton, PinSummary } from "@/components/guide/pickers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { errorText } from "@/components/partners/step";
import { isStepUpCancelled, useStepUp } from "@/components/verified/step-up";
import {
  WEEKDAYS,
  saveBranch,
  type BranchInput,
  type ChangerPortal,
  type MyBranch,
  type OpeningHours,
  type Weekday,
} from "@/lib/exchange";
import { inLebanon } from "@/lib/place-search";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";

function blank(): BranchInput {
  const hours: OpeningHours = {};
  for (const day of ["mon", "tue", "wed", "thu", "fri", "sat"] as Weekday[]) {
    hours[day] = [["09:00", "18:00"]];
  }
  return { branch_name: "", address: "", lat: 0, lng: 0, destination: "", hours, phone: "" };
}

function fromBranch(branch: MyBranch): BranchInput {
  return {
    id: branch.id,
    branch_name: branch.branch_name,
    address: branch.address,
    lat: branch.lat,
    lng: branch.lng,
    destination: branch.destination.slug,
    hours: branch.hours,
    phone: branch.phone,
    active: branch.active,
  };
}

/** A weekly opening-hours editor: one open/close pair per day, or closed. */
export function HoursEditor({ value, onChange }: { value: OpeningHours; onChange: (next: OpeningHours) => void }) {
  const copy = usePartnerCopy();
  return (
    <fieldset className="grid gap-2">
      <legend className="pb-1 text-sm font-medium">{copy.hours}</legend>
      {WEEKDAYS.map((day) => {
        const span = value[day]?.[0];
        return (
          <div
            key={day}
            className="grid grid-cols-[7rem_auto_1fr] items-center gap-3 text-sm sm:grid-cols-[8rem_auto_8rem_8rem]"
          >
            <span>{copy[day]}</span>
            <label className="inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!span}
                onChange={(event) => onChange({ ...value, [day]: event.target.checked ? [] : [["09:00", "18:00"]] })}
              />
              {copy.closed}
            </label>
            {span ? (
              <div className="col-span-3 flex gap-2 sm:col-span-2">
                <Input
                  type="time"
                  aria-label={`${copy[day]} ${copy.opens}`}
                  value={span[0]}
                  onChange={(event) => onChange({ ...value, [day]: [[event.target.value, span[1]]] })}
                />
                <Input
                  type="time"
                  aria-label={`${copy[day]} ${copy.closes}`}
                  value={span[1]}
                  onChange={(event) => onChange({ ...value, [day]: [[span[0], event.target.value]] })}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

/** Branches: where travellers come. Moving one on a live account needs a code and a new visit. */
export function ChangerBranches({
  portal,
  onChange,
}: {
  portal: ChangerPortal;
  onChange: (next: ChangerPortal) => void;
}) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { withStepUp, dialog } = useStepUp();
  const [editing, setEditing] = React.useState<BranchInput | null>(portal.offices.length ? null : blank());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof BranchInput>(key: K, value: BranchInput[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));
  const pinned = editing ? inLebanon(editing.lat, editing.lng) : false;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    const hours = Object.fromEntries(
      Object.entries(editing.hours).filter(([, spans]) => spans && spans.length),
    ) as OpeningHours;
    try {
      onChange(await withStepUp(() => saveBranch({ ...editing, hours })));
      setEditing(null);
    } catch (caught) {
      if (!isStepUpCancelled(caught)) setError(errorText(caught, verified.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      {dialog}
      {portal.offices.length ? (
        <ul className="grid gap-2">
          {portal.offices.map((branch) => (
            <li
              key={branch.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <MapPin className="size-5 shrink-0 text-text-muted" aria-hidden />
                <span className="grid min-w-0">
                  <span className="font-medium">{branch.branch_name}</span>
                  <span className="text-sm text-text-muted">
                    {branch.address} · {branch.destination.name}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={branch.verified ? "success" : "outline"}>
                  {branch.verified ? copy.branchVerified : copy.branchWaiting}
                </Badge>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(fromBranch(branch))}>
                  {copy.editVehicle}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{copy.noBranches}</p>
      )}
      {editing ? (
        <form
          className="grid gap-4 rounded-control border border-border-subtle p-4"
          onSubmit={(event) => void save(event)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="branch-name">{copy.branchName}</Label>
              <Input
                id="branch-name"
                required
                value={editing.branch_name}
                onChange={(event) => set("branch_name", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branch-destination">{copy.destination}</Label>
              <DestinationSelect
                id="branch-destination"
                value={editing.destination}
                onChange={(slug) => set("destination", slug)}
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="branch-address">{copy.address}</Label>
              <Input
                id="branch-address"
                required
                value={editing.address}
                onChange={(event) => set("address", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="branch-phone">{copy.phone}</Label>
              <Input
                id="branch-phone"
                type="tel"
                dir="ltr"
                value={editing.phone ?? ""}
                onChange={(event) => set("phone", event.target.value)}
              />
            </div>
          </div>
          <fieldset className="grid gap-3">
            <legend className="pb-1 text-sm font-medium">{copy.pin}</legend>
            <LocateButton
              onLocate={(lat, lng) => setEditing((current) => (current ? { ...current, lat, lng } : current))}
            />
            <div className="grid max-w-md grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="branch-lat">{copy.lat}</Label>
                <Input
                  id="branch-lat"
                  inputMode="decimal"
                  dir="ltr"
                  value={editing.lat || ""}
                  onChange={(event) => set("lat", Number(event.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="branch-lng">{copy.lng}</Label>
                <Input
                  id="branch-lng"
                  inputMode="decimal"
                  dir="ltr"
                  value={editing.lng || ""}
                  onChange={(event) => set("lng", Number(event.target.value))}
                />
              </div>
            </div>
            {pinned ? <PinSummary lat={editing.lat} lng={editing.lng} /> : null}
          </fieldset>
          <HoursEditor value={editing.hours} onChange={(hours) => set("hours", hours)} />
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !pinned || !editing.destination}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {copy.saveBranch}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              {verified.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setEditing(blank())}>
          <Plus aria-hidden />
          {copy.addBranch}
        </Button>
      )}
    </div>
  );
}
