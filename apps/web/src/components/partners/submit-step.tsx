"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { errorText } from "@/components/partners/step";
import { documentLabel } from "@/components/verified/document-uploader";
import { interpolate } from "@/i18n/catalogues";
import { submitPartnerApplication, type MyPartner, type PartnerKind } from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";

/** Everything still missing, in words, then the button. The API checks it all again. */
export function applicationBlockers(
  kind: PartnerKind,
  partner: MyPartner,
  copy: ReturnType<typeof usePartnerCopy>,
  verified: ReturnType<typeof useVerifiedCopy>,
  extra: string[] = [],
): string[] {
  const out: string[] = [];
  if (!partner.security.phone_verified) out.push(copy.needPhone);
  if (!partner.security.totp_enabled) out.push(copy.needTotp);
  if (kind === "driver" && partner.regions.length === 0) out.push(copy.needAreas);
  if (kind === "driver" && !partner.vehicles.some((vehicle) => vehicle.active !== false)) out.push(copy.needVehicle);
  out.push(...extra);
  const seen = new Set<string>();
  for (const item of partner.missing) {
    const label =
      documentLabel(item.kind, verified) + (item.plate ? ` (${item.plate})` : item.branch ? ` (${item.branch})` : "");
    if (!seen.has(label)) {
      seen.add(label);
      out.push(interpolate(copy.needDoc, { doc: label }));
    }
  }
  if (partner.agreement.accepted !== partner.agreement.current) out.push(copy.needAgreement);
  return out;
}

export function SubmitStep({
  kind,
  partner,
  extraBlockers = [],
  onChange,
}: {
  kind: PartnerKind;
  partner: MyPartner;
  extraBlockers?: string[];
  onChange: (next: MyPartner) => void;
}) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);
  const blockers = applicationBlockers(kind, partner, copy, verified, extraBlockers);
  const editable = partner.status === "draft" || partner.status === "rejected";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onChange(await submitPartnerApplication(kind));
      setSent(true);
    } catch (caught) {
      setError(errorText(caught, verified.loadError));
    } finally {
      setBusy(false);
    }
  }

  if (!editable) {
    return <p className="text-sm text-text-muted">{sent ? copy.submitted : verified[`status_${partner.status}`]}</p>;
  }
  return (
    <div className="grid gap-4">
      {blockers.length ? (
        <div className="grid gap-2">
          <h3 className="font-semibold">{copy.stillNeeded}</h3>
          <ul className="grid list-disc gap-1 ps-5 text-sm">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Button type="button" className="w-fit" disabled={busy || blockers.length > 0} onClick={() => void submit()}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        {busy ? copy.sending : copy.submit}
      </Button>
    </div>
  );
}
