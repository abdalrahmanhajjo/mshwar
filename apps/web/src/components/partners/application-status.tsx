"use client";

import { ArrowUpRight } from "lucide-react";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Notice } from "@/components/ui/notice";
import { documentLabel } from "@/components/verified/document-uploader";
import { TrustBadge, WhatWeChecked } from "@/components/verified/what-we-checked";
import { interpolate } from "@/i18n/catalogues";
import { formatDate } from "@/i18n/format";
import { daysUntil } from "@/lib/local-time";
import type { MyPartner, PartnerKind } from "@/lib/partners";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useVerifiedCopy, type VerifiedKey } from "@/lib/verified-copy";

/** Where the application stands, what is about to run out, and what travellers see. */
export function ApplicationStatus({ kind, partner }: { kind: PartnerKind; partner: MyPartner }) {
  const copy = usePartnerCopy();
  const verified = useVerifiedCopy();
  const { locale } = useLocale();
  const day = (value: string) => formatDate(locale, `${value}T12:00:00Z`, { dateStyle: "medium" });
  const expiring = partner.documents.filter(
    (doc) => doc.verification === "verified" && doc.valid && doc.lapses_on && daysUntil(doc.lapses_on) <= 30,
  );
  const body = {
    draft: copy.statusDraft,
    submitted: copy.statusSubmitted,
    approved: copy.statusApproved,
    rejected: interpolate(copy.statusRejected, { reason: partner.decision_reason }),
    suspended: interpolate(copy.statusSuspended, { reason: partner.decision_reason }),
  }[partner.status];
  const publicHref = kind === "driver" ? `/drivers/${partner.slug}` : null;

  return (
    <section
      aria-labelledby="application-status"
      className="grid gap-4 rounded-card border border-border-subtle bg-surface-raised p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="application-status" className="title-section text-[1.2rem]">
          {copy.statusTitle}
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded-pill bg-brand-subtle px-3 py-1 text-xs font-semibold">
            {verified[`status_${partner.status}` as VerifiedKey]}
          </span>
          <TrustBadge level={partner.trust_level} />
        </div>
      </div>
      <Notice tone={partner.status === "rejected" || partner.status === "suspended" ? "warning" : "info"}>
        {body}
      </Notice>
      {partner.trust_level === "lapsed" ? <Notice tone="danger">{copy.lapsedWarning}</Notice> : null}
      {expiring.map((doc) => (
        <Notice key={doc.id} tone="warning">
          {interpolate(copy.expiringSoon, { doc: documentLabel(doc.kind, verified), date: day(doc.lapses_on ?? "") })}
        </Notice>
      ))}
      {partner.status === "approved" ? (
        <div className="grid gap-3">
          <h3 className="font-semibold">{copy.previewTitle}</h3>
          <WhatWeChecked trust={partner.trust} compact />
          {publicHref && partner.live ? (
            <LocaleLink
              href={publicHref}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium underline"
            >
              {copy.publicPage}
              <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
            </LocaleLink>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
