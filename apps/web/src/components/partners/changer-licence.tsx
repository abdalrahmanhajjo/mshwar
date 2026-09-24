"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/ui/notice";
import { errorText } from "@/components/partners/step";
import { isStepUpCancelled, useStepUp } from "@/components/verified/step-up";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { saveLicence, type ChangerPortal } from "@/lib/exchange";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";

/** The BDL registration number, category and legal name, and whether they matched the list. */
export function ChangerLicence({
  portal,
  onChange,
}: {
  portal: ChangerPortal;
  onChange: (next: ChangerPortal) => void;
}) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { locale } = useLocale();
  const { withStepUp, dialog } = useStepUp();
  const [number, setNumber] = React.useState(portal.licence?.bdl_number ?? "");
  const [category, setCategory] = React.useState<"A" | "B">(portal.licence?.category ?? "A");
  const [legalName, setLegalName] = React.useState(portal.licence?.legal_name ?? "");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const status = portal.licence?.register_status;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onChange(
        await withStepUp(() => saveLicence({ bdl_number: number.trim(), category, legal_name: legalName.trim() })),
      );
    } catch (caught) {
      if (!isStepUpCancelled(caught)) setError(errorText(caught, verified.loadError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void save(event)} aria-label={copy.licenceTitle}>
      {dialog}
      <p className="text-sm text-text-muted">{copy.licenceBody}</p>
      {status ? (
        <Notice tone={status === "matched" ? "success" : status === "unchecked" ? "info" : "danger"} role="status">
          {status === "matched"
            ? interpolate(copy.register_matched, {
                date: portal.licence?.matched_on
                  ? formatDate(locale, `${portal.licence.matched_on}T12:00:00Z`, { dateStyle: "medium" })
                  : "",
              })
            : copy[`register_${status}`]}
        </Notice>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="bdl-number">{copy.bdlNumber}</Label>
          <Input
            id="bdl-number"
            dir="ltr"
            required
            maxLength={20}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bdl-category">{copy.category}</Label>
          <NativeSelect
            id="bdl-category"
            value={category}
            onChange={(event) => setCategory(event.target.value === "B" ? "B" : "A")}
          >
            <option value="A">{copy.categoryA}</option>
            <option value="B">{copy.categoryB}</option>
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="bdl-legal-name">{copy.legalName}</Label>
        <Input
          id="bdl-legal-name"
          required
          maxLength={160}
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />
      </div>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <Button type="submit" className="w-fit" disabled={busy || !number.trim() || legalName.trim().length < 2}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {copy.saveLicence}
      </Button>
    </form>
  );
}
