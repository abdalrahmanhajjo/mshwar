"use client";

import * as React from "react";
import { ArrowUpRight, BadgeCheck, Check, FileText, Loader2, ShieldCheck } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { useGuideCopy, type GuideCopy } from "@/lib/guide-copy";
import {
  fetchMyGuideProfile,
  uploadGuideDocument,
  saveGuideProfile,
  submitGuideApplication,
  acceptGuideAgreement,
  type DocumentKind,
  type GuideDocument,
  type GuideTier,
  type MyGuideProfile,
} from "@/lib/guides";
import { ApiError } from "@/lib/api/client";
import { fileToBase64 } from "@/lib/portal";
import { interpolate } from "@/i18n/catalogues";
import { cn, focusRing } from "@/lib/utils";
import { useGuideTrustCopy } from "@/lib/guide-trust-copy";
import { useSearchCopy } from "@/lib/search-copy";
import { LanguagePicker, RegionPicker } from "@/components/guide/pickers";
import { GUIDE_AGREEMENT_VERSION } from "@/lib/legal/guide-agreement";

const OPTIONAL_DOCUMENTS: DocumentKind[] = ["first_aid", "insurance", "driving"];

export function documentLabel(kind: DocumentKind, copy: GuideCopy): string {
  switch (kind) {
    case "licence":
      return copy.docLicence;
    case "id":
      return copy.docId;
    case "first_aid":
      return copy.docFirstAid;
    case "insurance":
      return copy.docInsurance;
    default:
      return copy.docDriving;
  }
}

function StatusPanel({ profile, copy }: { profile: MyGuideProfile; copy: GuideCopy }) {
  const status = profile.status;
  const label = {
    draft: copy.statusDraft,
    submitted: copy.statusSubmitted,
    approved: copy.statusApproved,
    rejected: copy.statusRejected,
    suspended: copy.statusSuspended,
  }[status];
  const body = {
    draft: copy.statusDraftBody,
    submitted: copy.statusSubmittedBody,
    approved: copy.statusApprovedBody,
    rejected: copy.statusRejectedBody,
    suspended: copy.statusSuspendedBody,
  }[status];
  const tone = status === "approved" ? "success" : status === "rejected" ? "danger" : "info";

  return (
    <div className="grid gap-3 rounded-card border border-border-subtle bg-surface-raised p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status === "approved" ? "accent" : "secondary"}>{label}</Badge>
        {profile.badge ? (
          <Badge variant="outline" className="gap-1.5">
            <BadgeCheck className="size-3.5" aria-hidden />
            {copy.badgeLicensed}
          </Badge>
        ) : null}
        {/* The badge is derived from the licence, so a lapse shows up here on its own. */}
        {profile.tier === "licensed" && profile.status === "approved" && !profile.badge ? (
          <Badge variant="outline" className="text-warning">
            {copy.badgeLapsed}
          </Badge>
        ) : null}
      </div>
      <Notice tone={tone}>{body}</Notice>
      {profile.decision_reason ? <p className="text-sm text-text-muted">{profile.decision_reason}</p> : null}
      {profile.status === "approved" ? (
        <Button asChild variant="outline" className="w-fit">
          <LocaleLink href={`/guides/${profile.slug}`}>
            {copy.viewPublicPage}
            <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
          </LocaleLink>
        </Button>
      ) : null}
    </div>
  );
}

function DocumentRow({
  kind,
  required,
  document,
  copy,
  pending,
  onSave,
}: {
  kind: DocumentKind;
  required: boolean;
  document: GuideDocument | undefined;
  copy: GuideCopy;
  pending: boolean;
  onSave: (kind: DocumentKind, file: File, expires: string) => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [expires, setExpires] = React.useState(document?.expires_on ?? "");
  const state = document
    ? document.expired
      ? copy.documentExpired
      : { pending: copy.documentPending, verified: copy.documentVerified, rejected: copy.documentRejected }[
          document.verification
        ]
    : null;

  return (
    <div className="grid gap-3 rounded-control border border-border-subtle bg-surface p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <FileText className="size-4 shrink-0 text-text-muted" aria-hidden />
          {documentLabel(kind, copy)}
          <Badge variant={required ? "secondary" : "outline"} className="text-xs">
            {required ? copy.documentRequired : copy.documentOptional}
          </Badge>
        </span>
        {state ? (
          <Badge
            variant="outline"
            className={cn(
              document?.verification === "verified" && !document?.expired && "text-success",
              (document?.verification === "rejected" || document?.expired) && "text-danger",
            )}
          >
            {state}
          </Badge>
        ) : null}
      </div>
      {document?.reason ? <p className="text-sm text-danger">{document.reason}</p> : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor={`doc-${kind}`} className="text-xs">
            {copy.documentFile}
          </Label>
          <Input
            id={`doc-${kind}`}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`exp-${kind}`} className="text-xs">
            {copy.documentExpires}
          </Label>
          <Input id={`exp-${kind}`} type="date" value={expires} onChange={(event) => setExpires(event.target.value)} />
        </div>
        <Button
          type="button"
          variant={document ? "outline" : "default"}
          disabled={pending || !file}
          onClick={() => file && onSave(kind, file, expires)}
        >
          {document ? copy.documentReplace : copy.documentAdd}
        </Button>
      </div>
    </div>
  );
}

/**
 * Apply to guide, and watch the application through review.
 *
 * One screen for the whole of G1: pick a tier, describe yourself, attach the
 * documents your tier owes, send it. Nothing here can grant a badge - the form
 * only ever asks; the decision belongs to a reviewer.
 */
export function GuideApplication() {
  const search = useSearchCopy();
  const copy = useGuideCopy();
  const trust = useGuideTrustCopy();
  const [agreeChecked, setAgreeChecked] = React.useState(false);
  const [profile, setProfile] = React.useState<MyGuideProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const [tier, setTier] = React.useState<GuideTier>("licensed");
  const [displayName, setDisplayName] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [languages, setLanguages] = React.useState<string[]>([]);
  const [regions, setRegions] = React.useState<string[]>([]);
  const [specialities, setSpecialities] = React.useState("");
  const [years, setYears] = React.useState("");
  const [phone, setPhone] = React.useState("");

  const adopt = React.useCallback((next: MyGuideProfile | null) => {
    setProfile(next);
    if (!next) {
      return;
    }
    setTier(next.tier);
    setDisplayName(next.display_name);
    setHeadline(next.headline);
    setBio(next.bio);
    setLanguages([...next.languages]);
    setRegions([...next.regions]);
    setSpecialities(next.specialities.join(", "));
    setYears(next.years_guiding === null ? "" : String(next.years_guiding));
    setPhone(next.phone);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    void fetchMyGuideProfile()
      .then((next) => {
        if (!cancelled) {
          adopt(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(copy.loadError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [adopt, copy.loadError]);

  async function run(task: () => Promise<MyGuideProfile>, markSaved = false) {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      adopt(await task());
      setSaved(markSaved);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : copy.loadError);
    } finally {
      setPending(false);
    }
  }

  const list = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const editable = !profile || profile.status === "draft" || profile.status === "rejected";
  const required: DocumentKind[] = profile?.required_documents ?? (tier === "licensed" ? ["id", "licence"] : ["id"]);
  const byKind = new Map((profile?.documents ?? []).map((item) => [item.kind, item]));
  const missing = required.filter((kind) => !byKind.has(kind));
  const agreementVersion = profile?.agreement?.current ?? GUIDE_AGREEMENT_VERSION;
  // Older API responses carry no agreement field; treat them as not needing one.
  const agreed = !profile?.agreement || profile.agreement.accepted === profile.agreement.current;

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-text-muted">
        <Loader2 className="size-6 animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow={copy.kicker}
        icon={<ShieldCheck aria-hidden />}
        title={copy.applyTitle}
        description={copy.applyBody}
      />

      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}

      {profile ? <StatusPanel profile={profile} copy={copy} /> : null}

      <section
        aria-labelledby="guide-form"
        className="grid gap-5 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
      >
        <h2 id="guide-form" className="title-section text-[1.25rem]">
          {copy.applyTitle}
        </h2>

        <fieldset className="grid gap-3" disabled={!editable}>
          <legend className="pb-2 text-sm font-medium">{copy.tierLabel}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["licensed", "host"] as GuideTier[]).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={tier === item}
                disabled={!editable}
                onClick={() => setTier(item)}
                className={cn(
                  "grid gap-1 rounded-card border p-4 text-start transition-colors disabled:opacity-60",
                  tier === item ? "border-brand bg-brand-subtle" : "border-border-subtle hover:bg-surface-sunken",
                  focusRing,
                )}
              >
                <span className="font-semibold">{item === "licensed" ? copy.tierLicensed : copy.tierHost}</span>
                <span className="text-sm text-text-muted">
                  {item === "licensed" ? copy.tierLicensedHint : copy.tierHostHint}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            {copy.nameLabel}
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {copy.headlineLabel}
            <Input
              value={headline}
              placeholder={copy.headlinePlaceholder}
              onChange={(event) => setHeadline(event.target.value)}
            />
          </label>
        </div>

        <label className="grid gap-1.5 text-sm font-medium">
          {copy.bioLabel}
          <Textarea
            rows={4}
            value={bio}
            placeholder={copy.bioPlaceholder}
            onChange={(event) => setBio(event.target.value)}
          />
        </label>

        <div className="grid gap-2">
          <span id="guide-languages" className="text-sm font-medium">
            {copy.languagesLabel}
          </span>
          <LanguagePicker value={languages} onChange={setLanguages} disabled={!editable} labelledBy="guide-languages" />
        </div>

        <div className="grid gap-2">
          <span id="guide-regions" className="text-sm font-medium">
            {copy.regionsLabel}
          </span>
          <p className="text-xs text-text-muted">{search.regionsHint}</p>
          <RegionPicker value={regions} onChange={setRegions} disabled={!editable} labelledBy="guide-regions" />
        </div>

        <label className="grid gap-1.5 text-sm font-medium">
          {copy.specialitiesLabel}
          <Input value={specialities} onChange={(event) => setSpecialities(event.target.value)} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium">
            {copy.yearsLabel}
            <Input type="number" min={0} max={70} value={years} onChange={(event) => setYears(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            {copy.phoneLabel}
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={pending || displayName.trim().length < 2}
            onClick={() =>
              void run(
                () =>
                  saveGuideProfile({
                    tier,
                    display_name: displayName.trim(),
                    headline: headline.trim(),
                    bio: bio.trim(),
                    languages,
                    regions,
                    specialities: list(specialities),
                    years_guiding: years ? Number(years) : null,
                    phone: phone.trim(),
                  }),
                true,
              )
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
            {pending ? copy.saving : copy.saveDraft}
          </Button>
          {saved ? <span className="text-sm text-text-muted">{copy.savedNote}</span> : null}
        </div>
      </section>

      {profile ? (
        <section
          aria-labelledby="guide-docs"
          className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
        >
          <div className="grid gap-1">
            <h2 id="guide-docs" className="title-section text-[1.25rem]">
              {copy.documentsTitle}
            </h2>
            <p className="text-sm text-text-muted">{copy.documentsBody}</p>
          </div>

          <div className="grid gap-3">
            {[...required, ...OPTIONAL_DOCUMENTS.filter((kind) => !required.includes(kind))].map((kind) => (
              <DocumentRow
                key={kind}
                kind={kind}
                required={required.includes(kind)}
                document={byKind.get(kind)}
                copy={copy}
                pending={pending}
                onSave={(chosen, file, expires) =>
                  void run(async () =>
                    uploadGuideDocument({
                      kind: chosen,
                      filename: file.name,
                      content_type: file.type || "application/pdf",
                      content_base64: await fileToBase64(file),
                      expires_on: expires || null,
                    }),
                  )
                }
              />
            ))}
          </div>

          {missing.length ? (
            <Notice tone="warning">
              {interpolate(copy.documentMissing, {
                list: missing.map((kind) => documentLabel(kind, copy)).join(", "),
              })}
            </Notice>
          ) : null}

          {editable ? (
            <div className="grid gap-3 rounded-control border border-border-subtle bg-surface p-4">
              <h3 className="font-medium">{trust.agreementTitle}</h3>
              <p className="text-sm text-text-muted">{trust.agreementBody}</p>
              <LocaleLink href="/guides/agreement" className="w-fit text-sm underline" target="_blank">
                {trust.agreementRead}
              </LocaleLink>
              {agreed ? (
                <p className="text-sm text-success">
                  {interpolate(trust.agreementAccepted, { version: agreementVersion })}
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={agreeChecked}
                      onChange={(event) => setAgreeChecked(event.target.checked)}
                    />
                    {interpolate(trust.agreementCheck, { version: agreementVersion })}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || !agreeChecked}
                    onClick={() => void run(() => acceptGuideAgreement(agreementVersion))}
                  >
                    {trust.agreementAccept}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {editable ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="lg"
                disabled={pending || missing.length > 0 || !agreed}
                onClick={() => void run(() => submitGuideApplication())}
              >
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
                {pending ? copy.submitting : copy.submitAction}
              </Button>
              {missing.length ? <span className="text-sm text-text-muted">{copy.submitBlocked}</span> : null}
              {!missing.length && !agreed ? (
                <span className="text-sm text-text-muted">{trust.agreementNeeded}</span>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
