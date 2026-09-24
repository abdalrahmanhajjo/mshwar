"use client";

import * as React from "react";
import { FileText, Loader2 } from "lucide-react";
import { useLocale } from "@/components/shell/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import {
  PHOTO_DOCUMENTS,
  type DocumentUploadInput,
  type PartnerDocument,
  type PartnerDocumentKind,
} from "@/lib/partners";
import { fileToBase64 } from "@/lib/portal";
import { cn } from "@/lib/utils";
import { useVerifiedCopy, type VerifiedKey } from "@/lib/verified-copy";

export function documentLabel(kind: PartnerDocumentKind, copy: ReturnType<typeof useVerifiedCopy>): string {
  return copy[`doc_${kind}` as VerifiedKey] ?? kind;
}

/**
 * One document a partner owes: its state, the reviewer's reason if it was
 * rejected, and a small form to upload or replace it with the dates it needs.
 */
export function DocumentUploader({
  kind,
  document,
  required = true,
  needsExpiry = false,
  needsIssued = false,
  fresh = false,
  withReference = false,
  vehicleId,
  officeId,
  onUpload,
}: {
  kind: PartnerDocumentKind;
  document?: PartnerDocument;
  required?: boolean;
  needsExpiry?: boolean;
  needsIssued?: boolean;
  fresh?: boolean;
  withReference?: boolean;
  /** For documents that belong to one vehicle or one branch. */
  vehicleId?: string;
  officeId?: string;
  onUpload: (input: DocumentUploadInput) => Promise<void>;
}) {
  const copy = useVerifiedCopy();
  const { locale } = useLocale();
  const id = React.useId();
  const [file, setFile] = React.useState<File | null>(null);
  const [expires, setExpires] = React.useState(document?.expires_on ?? "");
  const [issued, setIssued] = React.useState(document?.issued_on ?? "");
  const [reference, setReference] = React.useState(document?.reference ?? "");
  const [busy, setBusy] = React.useState(false);
  const photo = PHOTO_DOCUMENTS.has(kind);
  const state = document
    ? document.verification === "verified" && !document.valid
      ? copy.doc_lapsed
      : { pending: copy.doc_pending, verified: copy.doc_verified, rejected: copy.doc_rejected }[document.verification]
    : null;
  const ready = file !== null && (!needsExpiry || expires !== "") && (!needsIssued || issued !== "");

  async function upload() {
    if (!file) {
      return;
    }
    setBusy(true);
    try {
      await onUpload({
        kind,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        content_base64: await fileToBase64(file),
        reference: reference.trim(),
        issued_on: issued || null,
        expires_on: expires || null,
        ...(vehicleId ? { vehicle_id: vehicleId } : {}),
        ...(officeId ? { office_id: officeId } : {}),
      });
      setFile(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-control border border-border-subtle bg-surface p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <FileText className="size-4 shrink-0 text-text-muted" aria-hidden />
          {documentLabel(kind, copy)}
          <Badge variant={required ? "secondary" : "outline"} className="text-xs">
            {required ? copy.required : copy.optional}
          </Badge>
        </span>
        {state ? (
          <Badge
            variant="outline"
            className={cn(
              document?.verification === "verified" && document.valid && "text-success",
              (document?.verification === "rejected" || (document?.verification === "verified" && !document.valid)) &&
                "text-danger",
            )}
          >
            {state}
          </Badge>
        ) : null}
      </div>
      {document?.reason ? <p className="text-sm text-danger">{document.reason}</p> : null}
      {document?.lapses_on ? (
        <p className="text-xs text-text-muted">
          {interpolate(copy.docLapsesOn, {
            date: formatDate(locale, `${document.lapses_on}T12:00:00Z`, { dateStyle: "medium" }),
          })}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-file`} className="text-xs">
            {photo ? copy.photoFile : copy.file}
          </Label>
          <Input
            id={`${id}-file`}
            type="file"
            accept={photo ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp"}
            capture={kind === "selfie" ? "user" : undefined}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        {withReference ? (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-ref`} className="text-xs">
              {copy.reference}
            </Label>
            <Input
              id={`${id}-ref`}
              dir="ltr"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
        ) : null}
        {needsIssued ? (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-issued`} className="text-xs">
              {copy.issuedOn}
            </Label>
            <Input id={`${id}-issued`} type="date" value={issued} onChange={(event) => setIssued(event.target.value)} />
            {fresh ? <p className="text-xs text-text-muted">{copy.freshHint}</p> : null}
          </div>
        ) : null}
        {needsExpiry ? (
          <div className="grid gap-1.5">
            <Label htmlFor={`${id}-expires`} className="text-xs">
              {copy.expiresOn}
            </Label>
            <Input
              id={`${id}-expires`}
              type="date"
              value={expires}
              onChange={(event) => setExpires(event.target.value)}
            />
          </div>
        ) : null}
        <Button
          type="button"
          variant={document ? "outline" : "default"}
          disabled={busy || !ready}
          onClick={() => void upload()}
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {busy ? copy.uploading : document ? copy.replace : copy.upload}
        </Button>
      </div>
    </div>
  );
}
