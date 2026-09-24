"use client";

import * as React from "react";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { PartnerPhoto, vehicleText } from "@/components/local/driver-card";
import { useLocale } from "@/components/shell/locale-provider";
import { Notice } from "@/components/ui/notice";
import { TrustBadge } from "@/components/verified/what-we-checked";
import { interpolate } from "@/i18n/catalogues";
import { beirutDateTime } from "@/lib/local-time";
import { useLocalCopy, type LocalKey } from "@/lib/local-copy";
import type { TrustLevel } from "@/lib/partners";
import { usePartnerCopy, type PartnerKey } from "@/lib/partner-copy";
import { fetchSharedRide, type SharedRide } from "@/lib/rides";

const TRUST_LEVELS: TrustLevel[] = ["verified", "lapsed", "pending", "none"];

/** /rides/shared/[token]: what a family member sees. Driver, car, plate, time; nothing else. */
export function SharedRideView({ token }: { token: string }) {
  const copy = useLocalCopy();
  const partner = usePartnerCopy();
  const { locale } = useLocale();
  const [ride, setRide] = React.useState<SharedRide | null | undefined>(undefined);

  React.useEffect(() => {
    let cancelled = false;
    void fetchSharedRide(token)
      .then((next) => {
        if (!cancelled) setRide(next);
      })
      .catch(() => {
        if (!cancelled) setRide(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (ride === undefined) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (ride === null) {
    return (
      <Notice tone="warning" role="status" className="max-w-xl">
        {copy.sharedGone}
      </Notice>
    );
  }
  const level = TRUST_LEVELS.find((value) => value === ride.driver.trust_level) ?? "none";

  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <div className="grid gap-2">
        <h1 className="title-page text-balance">{interpolate(copy.sharedTitle, { name: copy.sharedTraveller })}</h1>
        <p className="text-text-muted">{copy.sharedBody}</p>
      </div>
      {ride.state !== "confirmed" ? (
        <Notice tone="info" role="status">
          {copy.sharedEnded} {copy[`tstate_${ride.state}` as LocalKey]}
        </Notice>
      ) : null}
      <section className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <PartnerPhoto url={ride.driver.photo_url} name={ride.driver.display_name} className="size-16" />
          <div className="grid gap-1">
            <p className="text-lg font-semibold">{ride.driver.display_name}</p>
            <TrustBadge level={level} className="w-fit" />
          </div>
        </div>
        <div className="grid gap-1 rounded-control border-2 border-brand bg-brand-subtle/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">{copy.checkPlate}</p>
          <p dir="ltr" className="text-2xl font-bold tracking-wider">
            {ride.vehicle.plate}
          </p>
          <p className="text-sm">{vehicleText(ride.vehicle, copy.vehicleLine)}</p>
        </div>
        <ul className="grid gap-1 text-sm">
          <li>
            {partner[`kind_${ride.kind}` as PartnerKey]} · {beirutDateTime(locale, ride.starts_at)}
          </li>
          <li>{interpolate(copy.pickupAt, { place: ride.pickup })}</li>
          {ride.dropoff ? <li>{interpolate(copy.dropoffAt, { place: ride.dropoff })}</li> : null}
        </ul>
      </section>
      <p className="flex items-start gap-2 text-sm text-text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {copy.sharedWorried}
      </p>
      <p className="flex items-start gap-2 text-sm">
        <Phone className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        {partner.emergency}
      </p>
    </div>
  );
}
