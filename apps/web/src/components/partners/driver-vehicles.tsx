"use client";

import * as React from "react";
import { Car, Loader2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { errorText } from "@/components/partners/step";
import { isStepUpCancelled, useStepUp } from "@/components/verified/step-up";
import { normalisePlate, saveVehicle, type MyPartner, type Vehicle, type VehicleInput } from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";

function blank(): VehicleInput {
  return { plate: "", make: "", model: "", colour: "", seats: 4, year: null, plate_rented: false };
}

function fromVehicle(vehicle: Vehicle): VehicleInput {
  return {
    id: vehicle.id,
    plate: vehicle.plate,
    make: vehicle.make,
    model: vehicle.model,
    colour: vehicle.colour,
    seats: vehicle.seats,
    year: vehicle.year,
    plate_rented: vehicle.plate_rented ?? false,
    active: vehicle.active ?? true,
  };
}

/** The vehicles a driver drives. On a live account a change needs a fresh authenticator code. */
export function DriverVehicles({ partner, onChange }: { partner: MyPartner; onChange: (next: MyPartner) => void }) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { withStepUp, dialog } = useStepUp();
  const [editing, setEditing] = React.useState<VehicleInput | null>(partner.vehicles.length ? null : blank());
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) {
      return;
    }
    setBusy(true);
    setError(null);
    const body = { ...editing, plate: normalisePlate(editing.plate) };
    try {
      onChange(await withStepUp(() => saveVehicle(body)));
      setEditing(null);
    } catch (caught) {
      if (!isStepUpCancelled(caught)) {
        setError(errorText(caught, verified.loadError));
      }
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof VehicleInput>(key: K, value: VehicleInput[K]) =>
    setEditing((current) => (current ? { ...current, [key]: value } : current));

  return (
    <div className="grid gap-4">
      {dialog}
      {partner.vehicles.length ? (
        <ul className="grid gap-2">
          {partner.vehicles.map((vehicle) => (
            <li
              key={vehicle.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border-subtle bg-surface px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Car className="size-5 shrink-0 text-text-muted" aria-hidden />
                <span className="grid min-w-0">
                  <span className="font-medium">
                    {vehicle.make} {vehicle.model} · {vehicle.colour}
                  </span>
                  <span className="text-sm text-text-muted">
                    <span dir="ltr" className="font-mono">
                      {vehicle.plate}
                    </span>{" "}
                    · {vehicle.seats} {copy.seats.toLowerCase()}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={vehicle.live ? "success" : "outline"}>
                  {vehicle.live ? copy.vehicleLive : copy.vehicleNotLive}
                </Badge>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(fromVehicle(vehicle))}>
                  {copy.editVehicle}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">{copy.noVehicles}</p>
      )}
      {editing ? (
        <form
          className="grid gap-4 rounded-control border border-border-subtle p-4"
          onSubmit={(event) => void save(event)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-plate">{copy.plate}</Label>
              <Input
                id="vehicle-plate"
                dir="ltr"
                required
                value={editing.plate}
                aria-describedby="vehicle-plate-hint"
                onChange={(event) => set("plate", event.target.value)}
                onBlur={(event) => set("plate", normalisePlate(event.target.value))}
              />
              <p id="vehicle-plate-hint" className="text-xs text-text-muted">
                {copy.plateHint}
              </p>
            </div>
            <label className="flex items-center gap-2 self-center text-sm">
              <input
                type="checkbox"
                checked={editing.plate_rented ?? false}
                onChange={(event) => set("plate_rented", event.target.checked)}
              />
              {copy.plateRented}
            </label>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-make">{copy.make}</Label>
              <Input
                id="vehicle-make"
                required
                value={editing.make}
                onChange={(event) => set("make", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-model">{copy.model}</Label>
              <Input
                id="vehicle-model"
                required
                value={editing.model}
                onChange={(event) => set("model", event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-colour">{copy.colour}</Label>
              <Input
                id="vehicle-colour"
                required
                value={editing.colour}
                onChange={(event) => set("colour", event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="vehicle-year">{copy.year}</Label>
                <Input
                  id="vehicle-year"
                  type="number"
                  min={1970}
                  max={2100}
                  value={editing.year ?? ""}
                  onChange={(event) => set("year", event.target.value ? Number(event.target.value) : null)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="vehicle-seats">{copy.seats}</Label>
                <Input
                  id="vehicle-seats"
                  type="number"
                  min={1}
                  max={16}
                  required
                  value={editing.seats}
                  onChange={(event) => set("seats", Number(event.target.value))}
                />
              </div>
            </div>
            {editing.id ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.active ?? true}
                  onChange={(event) => set("active", event.target.checked)}
                />
                {copy.vehicleActive}
              </label>
            ) : null}
          </div>
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {busy ? verified.saving : copy.saveVehicle}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
              {verified.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setEditing(blank())}>
          <Plus aria-hidden />
          {copy.addVehicle}
        </Button>
      )}
    </div>
  );
}
