"use client";

import * as React from "react";
import { Flag, Loader2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/components/partners/step";
import { usePartnerCopy, type PartnerKey } from "@/lib/partner-copy";
import { reportRide, type RideReportCategory } from "@/lib/rides";
import { useVerifiedCopy } from "@/lib/verified-copy";

const CATEGORIES: RideReportCategory[] = [
  "safety",
  "wrong_driver",
  "wrong_plate",
  "unsafe_vehicle",
  "overcharge",
  "no_show",
  "conduct",
  "other",
];

/** Either side of a ride reports a problem; urgent kinds reach a person at once. */
export function RideReport({ rideId }: { rideId: string }) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<RideReportCategory>("safety");
  const [details, setDetails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ escalated: boolean } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setResult(await reportRide(rideId, category, details.trim()));
    } catch (caught) {
      setError(errorText(caught, verified.loadError));
    } finally {
      setBusy(false);
    }
  }

  const emergency = (
    <p className="flex items-start gap-2 text-sm">
      <Phone className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <span>{copy.emergency}</span>
    </p>
  );

  if (result) {
    return (
      <div className="grid gap-2">
        <Notice tone="success" role="status">
          {copy.reportSent} {result.escalated ? copy.reportUrgent : null}
        </Notice>
        {emergency}
      </div>
    );
  }
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setOpen(true)}>
        <Flag aria-hidden />
        {copy.report}
      </Button>
    );
  }
  return (
    <form className="grid gap-3 rounded-control border border-border-subtle p-4" onSubmit={(event) => void send(event)}>
      {emergency}
      <div className="grid gap-1.5">
        <Label htmlFor={`report-kind-${rideId}`}>{copy.reportKind}</Label>
        <NativeSelect
          id={`report-kind-${rideId}`}
          value={category}
          onChange={(event) => setCategory(event.target.value as RideReportCategory)}
        >
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {copy[`cat_${item}` as PartnerKey]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`report-details-${rideId}`}>{copy.reportDetails}</Label>
        <Textarea
          id={`report-details-${rideId}`}
          rows={3}
          minLength={10}
          maxLength={4000}
          required
          value={details}
          onChange={(event) => setDetails(event.target.value)}
        />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || details.trim().length < 10}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.sendReport}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {verified.cancel}
        </Button>
      </div>
    </form>
  );
}
