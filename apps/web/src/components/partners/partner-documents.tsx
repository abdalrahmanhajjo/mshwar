"use client";

import * as React from "react";
import { Notice } from "@/components/ui/notice";
import { errorText } from "@/components/partners/step";
import { DocumentUploader } from "@/components/verified/document-uploader";
import { interpolate } from "@/i18n/catalogues";
import {
  uploadPartnerDocument,
  type DocumentUploadInput,
  type MyPartner,
  type PartnerDocumentKind,
  type PartnerKind,
  type Requirement,
} from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";

// A reference number worth typing in: the reviewer matches it against the issuer.
const WITH_REFERENCE: ReadonlySet<PartnerDocumentKind> = new Set([
  "id",
  "public_licence",
  "vehicle_registration",
  "insurance",
  "bdl_registration",
  "commercial_register",
]);

type Branch = { id: string; branch_name: string };

/**
 * Every document the partner owes: their own, then each vehicle's, then each
 * branch's shop front. The flags on each upload (expiry, issue date, freshness)
 * come from the requirements the API sends, so a new rule needs no new screen.
 */
export function PartnerDocuments({
  kind,
  partner,
  branches = [],
  onChange,
}: {
  kind: PartnerKind;
  partner: MyPartner;
  branches?: Branch[];
  onChange: (next: MyPartner) => void;
}) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const [error, setError] = React.useState<string | null>(null);
  const partnerScope = partner.requirements.filter((req) => req.scope === "partner");
  const vehicleScope = partner.requirements.filter((req) => req.scope === "vehicle");
  const officeScope = partner.requirements.filter((req) => req.scope === "office");

  async function upload(input: DocumentUploadInput) {
    setError(null);
    try {
      onChange(await uploadPartnerDocument(kind, input));
    } catch (caught) {
      setError(errorText(caught, verified.loadError));
      throw caught;
    }
  }

  const uploader = (req: Requirement, scope: { vehicleId?: string; officeId?: string } = {}, required = true) => {
    const document = partner.documents.find(
      (doc) =>
        doc.kind === req.kind &&
        (doc.vehicle_id ?? undefined) === scope.vehicleId &&
        (doc.office_id ?? undefined) === scope.officeId,
    );
    return (
      <DocumentUploader
        key={`${req.kind}-${scope.vehicleId ?? ""}-${scope.officeId ?? ""}-${document?.id ?? "new"}`}
        kind={req.kind}
        document={document}
        required={required}
        needsExpiry={req.needs_expiry}
        needsIssued={req.valid_days !== null || req.fresh_days !== null}
        fresh={req.fresh_days !== null}
        withReference={WITH_REFERENCE.has(req.kind)}
        vehicleId={scope.vehicleId}
        officeId={scope.officeId}
        onUpload={(input) => upload(input).catch(() => undefined)}
      />
    );
  };

  return (
    <div className="grid gap-5">
      <Notice>{verified.docsPrivate}</Notice>
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      <div className="grid gap-3">
        <h3 className="font-semibold">{copy.yourDocuments}</h3>
        {partnerScope.map((req) => uploader(req))}
      </div>
      {vehicleScope.length
        ? partner.vehicles
            .filter((vehicle) => vehicle.active !== false)
            .map((vehicle) => (
              <div key={vehicle.id} className="grid gap-3">
                <h3 className="font-semibold" dir="auto">
                  {interpolate(copy.vehicleDocuments, { plate: vehicle.plate })}
                </h3>
                {vehicleScope.map((req) => uploader(req, { vehicleId: vehicle.id }))}
                {vehicle.plate_rented
                  ? uploader(
                      {
                        kind: "plate_rental",
                        scope: "vehicle",
                        needs_expiry: true,
                        valid_days: null,
                        fresh_days: null,
                      },
                      { vehicleId: vehicle.id },
                    )
                  : null}
              </div>
            ))
        : null}
      {officeScope.length
        ? branches.map((branch) => (
            <div key={branch.id} className="grid gap-3">
              <h3 className="font-semibold">{interpolate(copy.branchDocuments, { branch: branch.branch_name })}</h3>
              {officeScope.map((req) => uploader(req, { officeId: branch.id }))}
            </div>
          ))
        : null}
    </div>
  );
}
