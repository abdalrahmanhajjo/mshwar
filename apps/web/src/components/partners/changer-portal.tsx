"use client";

import * as React from "react";
import { Banknote, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { ApplicationStatus } from "@/components/partners/application-status";
import { ChangerBranches } from "@/components/partners/changer-branches";
import { ChangerLicence } from "@/components/partners/changer-licence";
import { PartnerIntro } from "@/components/partners/driver-portal";
import { PartnerAgreementStep } from "@/components/partners/partner-agreement";
import { PartnerDocuments } from "@/components/partners/partner-documents";
import { PartnerProfileForm } from "@/components/partners/profile-form";
import { Step } from "@/components/partners/step";
import { SubmitStep } from "@/components/partners/submit-step";
import { SecurityPanel } from "@/components/verified/security-panel";
import { fetchChangerPortal, type ChangerPortal } from "@/lib/exchange";
import type { MyPartner } from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";

/** /exchange: from "List your exchange" to a verified, listed money changer. */
export function ChangerPortalView() {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const [portal, setPortal] = React.useState<ChangerPortal | null | undefined>(undefined);
  const [failed, setFailed] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    void fetchChangerPortal()
      .then((next) => {
        if (!cancelled) setPortal(next);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // Profile, document and agreement calls answer with the partner alone; keep the licence and branches.
  const mergePartner = (next: MyPartner) => {
    if (portal) {
      setPortal({ ...portal, ...next });
    } else {
      setVersion((value) => value + 1);
    }
  };

  if (failed) {
    return (
      <Notice tone="danger" role="alert">
        {verified.loadError}
      </Notice>
    );
  }
  if (portal === undefined) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (portal === null) {
    return (
      <PartnerIntro
        kicker={copy.exchangeKicker}
        title={copy.exchangeTitle}
        body={copy.exchangeBody}
        needs={[copy.exchangeNeed1, copy.exchangeNeed2, copy.exchangeNeed3, copy.driveNeed4]}
      >
        {starting ? (
          <section className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6">
            <h2 className="title-section text-[1.2rem]">{copy.stepProfile}</h2>
            <PartnerProfileForm kind="changer" partner={null} onSaved={() => setVersion((value) => value + 1)} />
          </section>
        ) : (
          <Button type="button" className="w-fit" onClick={() => setStarting(true)}>
            {copy.start}
          </Button>
        )}
      </PartnerIntro>
    );
  }

  const extra = [
    ...(portal.licence ? [] : [copy.needLicence]),
    ...(portal.offices.some((office) => office.active) ? [] : [copy.needBranch]),
  ];
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={copy.exchangeKicker}
        icon={<Banknote aria-hidden />}
        title={portal.display_name}
        description={copy.exchangeBody}
      />
      <ApplicationStatus kind="changer" partner={portal} />
      <Step
        n={1}
        id="security"
        title={copy.stepSecurity}
        done={portal.security.phone_verified && portal.security.totp_enabled}
      >
        <SecurityPanel status={portal.security} onChange={(security) => setPortal({ ...portal, security })} />
      </Step>
      <Step n={2} id="profile" title={copy.stepProfile} done={portal.display_name.length > 1}>
        <PartnerProfileForm kind="changer" partner={portal} onSaved={mergePartner} />
      </Step>
      <Step n={3} id="licence" title={copy.stepLicence} done={portal.licence?.register_status === "matched"}>
        <ChangerLicence portal={portal} onChange={setPortal} />
      </Step>
      <Step n={4} id="branches" title={copy.stepBranches} done={portal.offices.some((office) => office.verified)}>
        <ChangerBranches portal={portal} onChange={setPortal} />
      </Step>
      <Step n={5} id="documents" title={copy.stepDocuments} done={portal.missing.length === 0}>
        <PartnerDocuments
          kind="changer"
          partner={portal}
          branches={portal.offices.filter((office) => office.active)}
          onChange={mergePartner}
        />
      </Step>
      <Step
        n={6}
        id="agreement"
        title={copy.stepAgreement}
        done={portal.agreement.accepted === portal.agreement.current}
      >
        <PartnerAgreementStep kind="changer" partner={portal} onChange={mergePartner} />
      </Step>
      <Step n={7} id="submit" title={copy.stepSubmit} done={portal.status !== "draft" && portal.status !== "rejected"}>
        <SubmitStep kind="changer" partner={portal} extraBlockers={extra} onChange={mergePartner} />
      </Step>
    </div>
  );
}
