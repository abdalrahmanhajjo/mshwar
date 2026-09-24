"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, Clock, Loader2, MapPin, Plane, Send } from "lucide-react";
import { DestinationSelect, LocateButton, useDestinations } from "@/components/guide/pickers";
import { PlaceSearch } from "@/components/guide/place-search";
import { errorText } from "@/components/partners/step";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { withLocalePrefix } from "@/lib/locale";
import { beirutToIso, beirutToday } from "@/lib/local-time";
import { useLocalCopy } from "@/lib/local-copy";
import { usePartnerCopy } from "@/lib/partner-copy";
import { requestRide, type RideKind } from "@/lib/rides";
import { cn } from "@/lib/utils";

type Spot = { name: string; lat: number | null; lng: number | null };
const EMPTY: Spot = { name: "", lat: null, lng: null };
/** Beirut–Rafic Hariri International Airport, arrivals hall. */
const AIRPORT = { lat: 33.8209, lng: 35.4884 };

function PlaceField({
  id,
  label,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  value: Spot;
  onChange: (next: Spot) => void;
  required?: boolean;
}) {
  const copy = useLocalCopy();
  return (
    <fieldset className="grid gap-2 rounded-control border border-border-subtle p-3">
      <legend className="px-1 text-sm font-medium">{label}</legend>
      <Input
        id={id}
        aria-label={label}
        required={required}
        maxLength={160}
        value={value.name}
        onChange={(event) => onChange({ name: event.target.value, lat: null, lng: null })}
      />
      <p className="text-xs text-text-muted">{copy.placeHint}</p>
      <PlaceSearch
        id={`${id}-search`}
        label={copy.findPlace}
        onPick={(hit) => onChange({ name: hit.title, lat: hit.lat, lng: hit.lng })}
      />
      <div className="flex flex-wrap items-center gap-3">
        <LocateButton onLocate={(lat, lng) => onChange({ name: value.name || copy.useMyLocation, lat, lng })} />
        {value.lat !== null && value.lng !== null ? (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <MapPin className="size-3.5" aria-hidden />
            {copy.pinned}
          </span>
        ) : null}
      </div>
    </fieldset>
  );
}

/** /rides/new: one request to every verified driver covering the area. */
export function NewRideForm() {
  const copy = useLocalCopy();
  const partner = usePartnerCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const destinations = useDestinations();
  const initialKind = params?.get("kind");
  const [kind, setKind] = React.useState<RideKind>(
    initialKind === "day" || initialKind === "airport" ? initialKind : "ride",
  );
  const [destination, setDestination] = React.useState(params?.get("destination") ?? "");
  const [pickup, setPickup] = React.useState<Spot>({ ...EMPTY, name: params?.get("pickup") ?? "" });
  const [dropoff, setDropoff] = React.useState<Spot>({ ...EMPTY, name: params?.get("dropoff") ?? "" });
  const [date, setDate] = React.useState(params?.get("date") ?? beirutToday());
  const [time, setTime] = React.useState("10:00");
  const [hours, setHours] = React.useState("8");
  const [party, setParty] = React.useState("2");
  const [luggage, setLuggage] = React.useState("0");
  const [flight, setFlight] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const tripId = params?.get("trip") ?? null;
  const beirut = destinations.find((row) => row.slug === "beirut");

  const kinds: { value: RideKind; label: string; hint: string; icon: React.ReactNode }[] = [
    { value: "ride", label: partner.kind_ride, hint: copy.kindRideHint, icon: <Car className="size-5" aria-hidden /> },
    { value: "day", label: partner.kind_day, hint: copy.kindDayHint, icon: <Clock className="size-5" aria-hidden /> },
    {
      value: "airport",
      label: partner.kind_airport,
      hint: copy.kindAirportHint,
      icon: <Plane className="size-5" aria-hidden />,
    },
  ];

  function chooseKind(next: RideKind) {
    setKind(next);
    if (next === "airport") {
      setPickup({ name: copy.airportName, ...AIRPORT });
      if (!destination && beirut) setDestination(beirut.slug);
    } else if (kind === "airport" && pickup.name === copy.airportName) {
      setPickup(EMPTY);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await requestRide({
        kind,
        destination,
        trip_id: tripId,
        pickup_name: pickup.name.trim(),
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_name: dropoff.name.trim(),
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        starts_at: beirutToIso(date, time),
        hours: kind === "day" ? Number(hours) : null,
        party_size: Number(party),
        luggage: Number(luggage),
        flight_number: kind === "airport" ? flight.trim().toUpperCase() : "",
        notes: notes.trim(),
      });
      router.push(withLocalePrefix(locale, `/rides/${created.id}`));
    } catch (caught) {
      setError(errorText(caught, copy.loadError));
      setBusy(false);
    }
  }

  const ready =
    destination !== "" &&
    pickup.name.trim().length >= 2 &&
    (kind !== "ride" || dropoff.name.trim().length >= 2) &&
    (kind !== "airport" || flight.trim().length >= 3);

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.driversTitle}
        icon={<Car aria-hidden />}
        title={copy.newRideTitle}
        description={copy.newRideBody}
      />
      <form className="grid max-w-2xl gap-6" onSubmit={(event) => void submit(event)}>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{copy.kindLabel}</legend>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {kinds.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "grid cursor-pointer gap-1 rounded-card border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus",
                  kind === option.value ? "border-brand bg-brand-subtle/50" : "border-border-subtle bg-surface-raised",
                )}
              >
                <input
                  type="radio"
                  name="ride-kind"
                  value={option.value}
                  checked={kind === option.value}
                  onChange={() => chooseKind(option.value)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 font-semibold">
                  {option.icon}
                  {option.label}
                </span>
                <span className="text-text-muted">{option.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-1.5">
          <Label htmlFor="ride-destination">{copy.areaLabel}</Label>
          <DestinationSelect id="ride-destination" value={destination} onChange={setDestination} />
        </div>

        <PlaceField id="ride-pickup" label={copy.pickupLabel} value={pickup} onChange={setPickup} required />
        <PlaceField
          id="ride-dropoff"
          label={kind === "ride" ? copy.dropoffLabel : copy.dropoffOptional}
          value={dropoff}
          onChange={setDropoff}
          required={kind === "ride"}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="ride-date">{copy.dateLabel}</Label>
            <Input
              id="ride-date"
              type="date"
              min={beirutToday()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ride-time">{copy.timeLabel}</Label>
            <Input id="ride-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
            <p className="text-xs text-text-muted">{copy.timeHint}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {kind === "day" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="ride-hours">{copy.hoursLabel}</Label>
              <Input
                id="ride-hours"
                type="number"
                min={2}
                max={14}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
              />
            </div>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="ride-party">{copy.partyLabel}</Label>
            <Input
              id="ride-party"
              type="number"
              min={1}
              max={16}
              value={party}
              onChange={(event) => setParty(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ride-luggage">{copy.luggageLabel}</Label>
            <Input
              id="ride-luggage"
              type="number"
              min={0}
              max={20}
              value={luggage}
              onChange={(event) => setLuggage(event.target.value)}
            />
          </div>
        </div>

        {kind === "airport" ? (
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="ride-flight">{copy.flightLabel}</Label>
            <Input
              id="ride-flight"
              dir="ltr"
              maxLength={12}
              autoCapitalize="characters"
              value={flight}
              onChange={(event) => setFlight(event.target.value)}
              required
            />
          </div>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="ride-notes">{copy.notesLabel}</Label>
          <Textarea
            id="ride-notes"
            rows={3}
            maxLength={1000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <p className="text-xs text-text-muted">{copy.notesHint}</p>
        </div>

        {error ? (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        ) : null}
        <Button type="submit" size="lg" className="w-fit" disabled={busy || !ready}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send aria-hidden />}
          {copy.sendRequest}
        </Button>
      </form>
    </div>
  );
}
