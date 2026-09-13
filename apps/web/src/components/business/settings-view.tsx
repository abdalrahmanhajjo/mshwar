"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessCopy } from "@/lib/business-copy";
import { fileToBase64, submitVerification, updateContacts, uploadPortalFile } from "@/lib/portal";
import { usePortal } from "@/components/business/portal-provider";

export function SettingsView() {
  const copy = useBusinessCopy();
  const { org, refresh } = usePortal();
  const [publicEmail, setPublicEmail] = React.useState("");
  const [internalEmail, setInternalEmail] = React.useState("");
  const [fulfilment, setFulfilment] = React.useState("");
  const [legalName, setLegalName] = React.useState("");
  const [registration, setRegistration] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!org) {
      return;
    }
    setPublicEmail(org.public_contact.email ?? "");
    setInternalEmail(org.internal_contact?.email ?? "");
    setFulfilment(org.fulfilment_instructions ?? "");
    setLegalName(org.name);
  }, [org]);

  if (!org) {
    return null;
  }
  const current = org;

  async function onSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await updateContacts(current.id, {
      public_contact: { email: publicEmail },
      internal_contact: { email: internalEmail },
      fulfilment_instructions: fulfilment,
    });
    await refresh();
    setStatus(copy.internalNeverPublic);
  }

  async function onVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitVerification(current.id, { legal_name: legalName, registration_number: registration });
    await refresh();
    setStatus(copy.submitVerification);
  }

  async function onDoc(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await uploadPortalFile(current.id, {
      filename: file.name,
      content_type: file.type || "application/pdf",
      content_base64: await fileToBase64(file),
      purpose: "verification",
    });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{copy.publicContact}</CardTitle>
          <CardDescription>{copy.internalNeverPublic}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => void onSave(event)}>
            <Label htmlFor="public-email">{copy.publicContact}</Label>
            <Input
              id="public-email"
              type="email"
              value={publicEmail}
              onChange={(event) => setPublicEmail(event.target.value)}
            />
            <Label htmlFor="internal-email">{copy.internalContact}</Label>
            <Input
              id="internal-email"
              type="email"
              value={internalEmail}
              onChange={(event) => setInternalEmail(event.target.value)}
            />
            <Label htmlFor="fulfilment">{copy.fulfilment}</Label>
            <Textarea id="fulfilment" value={fulfilment} onChange={(event) => setFulfilment(event.target.value)} />
            <Button type="submit">{copy.saveListing}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.submitVerification}</CardTitle>
          <CardDescription>{copy.supportingDocs}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => void onVerify(event)}>
            <Label htmlFor="legal">{copy.legalName}</Label>
            <Input id="legal" value={legalName} onChange={(event) => setLegalName(event.target.value)} />
            <Label htmlFor="reg">{copy.registrationNumber}</Label>
            <Input id="reg" value={registration} onChange={(event) => setRegistration(event.target.value)} />
            <Label htmlFor="doc">{copy.uploadDoc}</Label>
            <Input id="doc" type="file" onChange={(event) => void onDoc(event)} />
            <Button type="submit">{copy.submitVerification}</Button>
          </form>
        </CardContent>
      </Card>
      {status ? (
        <p role="status" className="text-sm">
          {status}
        </p>
      ) : null}
    </div>
  );
}
