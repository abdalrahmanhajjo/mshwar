"use client";

import { Clock, Luggage, MapPin, Plane, Users } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { interpolate } from "@/i18n/catalogues";
import { beirutDateTime } from "@/lib/local-time";
import { usePartnerCopy, type PartnerKey } from "@/lib/partner-copy";
import type { RideRequest } from "@/lib/rides";

/** Where from, where to, when and for whom: the same lines on both sides of a ride. */
export function RideSummary({ request }: { request: RideRequest }) {
  const copy = usePartnerCopy();
  const { locale } = useLocale();
  return (
    <div className="grid gap-2 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
        <MapPin className="size-4 shrink-0 text-text-muted" aria-hidden />
        <span>{request.pickup.name}</span>
        {request.dropoff.name ? (
          <>
            <span aria-hidden className="text-text-muted rtl:rotate-180">
              →
            </span>
            <span>{request.dropoff.name}</span>
          </>
        ) : null}
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-text-muted">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden />
          {beirutDateTime(locale, request.starts_at)}
        </span>
        <span>{copy[`kind_${request.kind}` as PartnerKey]}</span>
        {request.hours ? <span>{interpolate(copy.hoursN, { n: String(request.hours) })}</span> : null}
        <span className="inline-flex items-center gap-1">
          <Users className="size-3.5" aria-hidden />
          {interpolate(copy.party, { n: String(request.party_size) })}
        </span>
        {request.luggage ? (
          <span className="inline-flex items-center gap-1">
            <Luggage className="size-3.5" aria-hidden />
            {interpolate(copy.luggageN, { n: String(request.luggage) })}
          </span>
        ) : null}
        {request.flight_number ? (
          <span className="inline-flex items-center gap-1" dir="ltr">
            <Plane className="size-3.5" aria-hidden />
            {interpolate(copy.flight, { flight: request.flight_number })}
          </span>
        ) : null}
      </p>
      {request.notes ? <p className="whitespace-pre-line text-text">{request.notes}</p> : null}
    </div>
  );
}
