"use client";

import * as React from "react";
import { Car, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { ApplicationStatus } from "@/components/partners/application-status";
import { DriverVehicles } from "@/components/partners/driver-vehicles";
import { PartnerAgreementStep } from "@/components/partners/partner-agreement";
import { PartnerDocuments } from "@/components/partners/partner-documents";
import { PartnerProfileForm } from "@/components/partners/profile-form";
import { Step, errorText } from "@/components/partners/step";
import { SubmitStep } from "@/components/partners/submit-step";
import { SecurityPanel } from "@/components/verified/security-panel";
import { fetchMyPartner, type MyPartner, type SecurityStatus } from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { setDriverTerms } from "@/lib/rides";
import { useVerifiedCopy } from "@/lib/verified-copy";

export function PartnerIntro({
  kicker,
  title,
  body,
  needs,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  needs: string[];
  children: React.ReactNode;
}) {
  const copy = usePartnerCopy();
  return (
    <div className="grid gap-8">
      <PageHeader eyebrow={kicker} icon={<Car aria-hidden />} title={title} description={body} />
      <section className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
        <h2 className="font-semibold">{copy.driveNeeds}</h2>
        <ul className="grid gap-2 text-sm">
          {needs.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              {item}
            </li>
          ))}
        </ul>
      </section>
      {children}
    </div>
  );
}

function DriverTerms() {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const [rate, setRate] = React.useState("");
  const [airport, setAirport] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await setDriverTerms(rate ? Math.round(Number(rate) * 100) : null, airport);
      setMessage({ tone: "success", text: copy.saved });
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, verified.loadError) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void save(event)}>
      <div className="grid gap-1.5 sm:max-w-xs">
        <Label htmlFor="day-rate">{copy.dayRate}</Label>
        <Input
          id="day-rate"
          type="number"
          min={10}
          max={1000}
          step={5}
          dir="ltr"
          value={rate}
          onChange={(event) => setRate(event.target.value)}
        />
        <p className="text-xs text-text-muted">{copy.dayRateHint}</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={airport} onChange={(event) => setAirport(event.target.checked)} />
        {copy.airportPickups}
      </label>
      {message ? (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
      <Button type="submit" className="w-fit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {copy.saveTerms}
      </Button>
    </form>
  );
}

/** /drive: from "Drive with Mshwar" to a live, verified driver. */
export function DriverPortal() {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const [partner, setPartner] = React.useState<MyPartner | null | undefined>(undefined);
  const [failed, setFailed] = React.useState(false);
  const [starting, setStarting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void fetchMyPartner("driver")
      .then((next) => {
        if (!cancelled) setPartner(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {verified.loadError}
      </Notice>
    );
  }
  if (partner === undefined) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (partner === null) {
    return (
      <PartnerIntro
        kicker={copy.driveKicker}
        title={copy.driveTitle}
        body={copy.driveBody}
        needs={[copy.driveNeed1, copy.driveNeed2, copy.driveNeed3, copy.driveNeed4]}
      >
        {starting ? (
          <section className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
            <h2 className="title-section text-[1.2rem]">{copy.stepProfile}</h2>
            <PartnerProfileForm kind="driver" partner={null} onSaved={setPartner} />
          </section>
        ) : (
          <Button type="button" className="w-fit" onClick={() => setStarting(true)}>
            {copy.start}
          </Button>
        )}
      </PartnerIntro>
    );
  }

  const setSecurity = (security: SecurityStatus) => setPartner({ ...partner, security });
  const docsDone = partner.missing.length === 0;
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={copy.driveKicker}
        icon={<Car aria-hidden />}
        title={partner.display_name}
        description={copy.driveBody}
      />
      <ApplicationStatus kind="driver" partner={partner} />
      <Step
        n={1}
        id="security"
        title={copy.stepSecurity}
        done={partner.security.phone_verified && partner.security.totp_enabled}
      >
        <SecurityPanel status={partner.security} onChange={setSecurity} />
      </Step>
      <Step n={2} id="profile" title={copy.stepProfile} done={partner.regions.length > 0}>
        <PartnerProfileForm kind="driver" partner={partner} onSaved={setPartner} />
      </Step>
      <Step
        n={3}
        id="vehicles"
        title={copy.stepVehicles}
        done={partner.vehicles.some((vehicle) => vehicle.active !== false)}
      >
        <DriverVehicles partner={partner} onChange={setPartner} />
      </Step>
      <Step n={4} id="documents" title={copy.stepDocuments} done={docsDone}>
        <PartnerDocuments kind="driver" partner={partner} onChange={setPartner} />
      </Step>
      <Step
        n={5}
        id="agreement"
        title={copy.stepAgreement}
        done={partner.agreement.accepted === partner.agreement.current}
      >
        <PartnerAgreementStep kind="driver" partner={partner} onChange={setPartner} />
      </Step>
      <Step
        n={6}
        id="submit"
        title={copy.stepSubmit}
        done={partner.status !== "draft" && partner.status !== "rejected"}
      >
        <SubmitStep kind="driver" partner={partner} onChange={setPartner} />
      </Step>
      {partner.status === "approved" ? (
        <section className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
          <h2 className="title-section text-[1.2rem]">{copy.termsTitle}</h2>
          <DriverTerms />
        </section>
      ) : null}
    </div>
  );
}
