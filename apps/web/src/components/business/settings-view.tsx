"use client";

import * as React from "react";
import { Lock, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessCopy } from "@/lib/business-copy";
import {
  fileToBase64,
  submitVerification,
  updateContacts,
  uploadPortalFile,
  type PortalOrganization,
} from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function SettingsView() {
  const { org } = usePortal();
  if (!org) {
    return null;
  }
  return <SettingsForm key={org.id} org={org} />;
}

function SettingsForm({ org }: { org: PortalOrganization }) {
  const copy = useBusinessCopy();
  const { refresh } = usePortal();
  const [publicEmail, setPublicEmail] = React.useState(org.public_contact.email ?? "");
  const [internalEmail, setInternalEmail] = React.useState(org.internal_contact?.email ?? "");
  const [fulfilment, setFulfilment] = React.useState(org.fulfilment_instructions ?? "");
  const [legalName, setLegalName] = React.useState(org.name);
  const [registration, setRegistration] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateContacts(org.id, {
      public_contact: { email: publicEmail },
      internal_contact: { email: internalEmail },
      fulfilment_instructions: fulfilment,
    });
    await refresh();
    setStatus(copy.internalNeverPublic);
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitVerification(org.id, { legal_name: legalName, registration_number: registration });
    await refresh();
    setStatus(copy.submitVerification);
  }

  async function onDoc(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await uploadPortalFile(org.id, {
      filename: file.name,
      content_type: file.type || "application/pdf",
      content_base64: await fileToBase64(file),
      purpose: "verification",
    });
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.portalKicker}
        title={copy.settingsTitle}
        description={copy.settingsBody}
        actions={
          <Badge variant={org.verification === "verified" ? "success" : "warning"} className="px-3 py-1 text-sm">
            {org.verification === "verified" ? copy.verifiedBadge : org.verification}
          </Badge>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.publicContact}</CardTitle>
            <CardDescription>{copy.internalNeverPublic}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void onSave(event)}>
              <div className="grid gap-2">
                <Label htmlFor="public-email">{copy.publicContact}</Label>
                <Input
                  id="public-email"
                  type="email"
                  value={publicEmail}
                  onChange={(event) => setPublicEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="internal-email" className="inline-flex items-center gap-1.5">
                  <Lock className="size-3.5" aria-hidden />
                  {copy.internalContact}
                </Label>
                <Input
                  id="internal-email"
                  type="email"
                  value={internalEmail}
                  onChange={(event) => setInternalEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fulfilment">{copy.fulfilment}</Label>
                <Textarea id="fulfilment" value={fulfilment} onChange={(event) => setFulfilment(event.target.value)} />
              </div>
              <Button type="submit" className="w-fit">
                <Save aria-hidden />
                {copy.saveListing}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{copy.submitVerification}</CardTitle>
            <CardDescription>{copy.supportingDocs}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => void onVerify(event)}>
              <div className="grid gap-2">
                <Label htmlFor="legal">{copy.legalName}</Label>
                <Input id="legal" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reg">{copy.registrationNumber}</Label>
                <Input id="reg" value={registration} onChange={(event) => setRegistration(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="doc">{copy.uploadDoc}</Label>
                <Input id="doc" type="file" onChange={(event) => void onDoc(event)} />
              </div>
              <Button type="submit" className="w-fit">
                <ShieldCheck aria-hidden />
                {copy.submitVerification}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      {status ? (
        <Notice tone="success">
          <p role="status">{status}</p>
        </Notice>
      ) : null}
    </div>
  );
}
