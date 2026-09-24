"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { LanguagePicker, RegionPicker } from "@/components/guide/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { Textarea } from "@/components/ui/textarea";
import { errorText } from "@/components/partners/step";
import { savePartnerProfile, type MyPartner, type PartnerKind } from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy } from "@/lib/verified-copy";

/** Name, a line about them, languages and (for drivers) the areas they cover, all picked by name. */
export function PartnerProfileForm({
  kind,
  partner,
  onSaved,
}: {
  kind: PartnerKind;
  partner: MyPartner | null;
  onSaved: (next: MyPartner) => void;
}) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const [name, setName] = React.useState(partner?.display_name ?? "");
  const [headline, setHeadline] = React.useState(partner?.headline ?? "");
  const [bio, setBio] = React.useState(partner?.bio ?? "");
  const [languages, setLanguages] = React.useState<string[]>(partner?.languages ?? []);
  const [regions, setRegions] = React.useState<string[]>(partner?.regions ?? []);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const locked = partner?.status === "submitted";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const next = await savePartnerProfile(kind, {
        display_name: name.trim(),
        headline: headline.trim(),
        bio: bio.trim(),
        languages,
        ...(kind === "driver" ? { regions } : {}),
      });
      onSaved(next);
      setMessage({ tone: "success", text: copy.saved });
    } catch (caught) {
      setMessage({ tone: "danger", text: errorText(caught, verified.loadError) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void save(event)} aria-label={copy.stepProfile}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${kind}-name`}>{kind === "changer" ? copy.businessName : copy.nameLabel}</Label>
          <Input
            id={`${kind}-name`}
            required
            minLength={2}
            maxLength={80}
            value={name}
            disabled={locked}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${kind}-headline`}>{copy.headline}</Label>
          <Input
            id={`${kind}-headline`}
            maxLength={140}
            value={headline}
            onChange={(event) => setHeadline(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${kind}-bio`}>{copy.bio}</Label>
        <Textarea
          id={`${kind}-bio`}
          rows={3}
          maxLength={2000}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <span id={`${kind}-languages`} className="text-sm font-medium">
          {copy.languages}
        </span>
        <LanguagePicker value={languages} onChange={setLanguages} labelledBy={`${kind}-languages`} />
      </div>
      {kind === "driver" ? (
        <div className="grid gap-2">
          <span id="driver-areas" className="text-sm font-medium">
            {copy.areas}
          </span>
          <p className="text-xs text-text-muted">{copy.areasHint}</p>
          <RegionPicker value={regions} onChange={setRegions} labelledBy="driver-areas" />
        </div>
      ) : null}
      {message ? (
        <Notice tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Notice>
      ) : null}
      <Button type="submit" className="w-fit" disabled={busy || name.trim().length < 2}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {busy ? verified.saving : copy.saveProfile}
      </Button>
    </form>
  );
}
