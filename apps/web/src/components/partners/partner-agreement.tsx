"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { errorText } from "@/components/partners/step";
import { interpolate } from "@/i18n/catalogues";
import { PARTNER_AGREEMENTS, PARTNER_AGREEMENT_VERSION } from "@/lib/legal/partner-agreements";
import { acceptPartnerAgreement, type MyPartner, type PartnerKind } from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useTrustCopy } from "@/lib/trust-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";

/** The agreement text, then an explicit acceptance of the exact version shown. */
export function PartnerAgreementStep({
  kind,
  partner,
  onChange,
}: {
  kind: PartnerKind;
  partner: MyPartner;
  onChange: (next: MyPartner) => void;
}) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const trust = useTrustCopy();
  const { locale } = useLocale();
  const doc = PARTNER_AGREEMENTS[kind][locale];
  const current = partner.agreement.current || PARTNER_AGREEMENT_VERSION;
  const accepted = partner.agreement.accepted === current;
  const [open, setOpen] = React.useState(!accepted);
  const [ticked, setTicked] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      onChange(await acceptPartnerAgreement(kind, current));
    } catch (caught) {
      setError(errorText(caught, verified.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-text-muted">
        {doc.title} · {trust.legalVersion} <span className="tabular-nums">{current}</span>
      </p>
      {partner.agreement.accepted && !accepted ? <Notice tone="warning">{copy.agreementNew}</Notice> : null}
      <Button
        type="button"
        variant="ghost"
        className="w-fit"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? copy.hideAgreement : copy.readAgreement}
      </Button>
      {open ? (
        <article className="grid max-h-[28rem] gap-4 overflow-y-auto rounded-control border border-border-subtle bg-surface p-4">
          <p className="text-sm text-text-muted">{doc.summary}</p>
          {doc.sections.map((section) => (
            <section key={section.id} className="grid gap-2">
              <h3 className="font-semibold">{section.heading}</h3>
              {section.body.map((block, index) =>
                typeof block === "string" ? (
                  <p key={index} className="text-sm leading-relaxed">
                    {block}
                  </p>
                ) : (
                  <ul key={index} className="grid list-disc gap-1.5 ps-5 text-sm leading-relaxed">
                    {block.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ),
              )}
            </section>
          ))}
        </article>
      ) : null}
      {accepted ? (
        <p className="flex items-center gap-2 text-sm text-success" role="status">
          <CheckCircle2 className="size-4" aria-hidden />
          {interpolate(copy.agreementAccepted, { version: current })}
        </p>
      ) : (
        <div className="grid gap-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={ticked}
              onChange={(event) => setTicked(event.target.checked)}
            />
            {copy.agreementAccept}
          </label>
          {error ? (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          ) : null}
          <Button type="button" className="w-fit" disabled={!ticked || busy} onClick={() => void accept()}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {copy.agreementButton}
          </Button>
        </div>
      )}
    </div>
  );
}
