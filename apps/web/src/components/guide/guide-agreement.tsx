"use client";

import { useLocale } from "@/components/shell/locale-provider";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/i18n/format";
import { GUIDE_AGREEMENT, GUIDE_AGREEMENT_VERSION } from "@/lib/legal/guide-agreement";
import { useTrustCopy } from "@/lib/trust-copy";

const REVIEWED = process.env.NEXT_PUBLIC_LEGAL_REVIEWED === "true";

/** /guides/agreement: the guide agreement and code of conduct, public so anyone can read it first. */
export function GuideAgreementView() {
  const { locale, t } = useLocale();
  const copy = useTrustCopy();
  const doc = GUIDE_AGREEMENT[locale];
  return (
    <article className="grid max-w-3xl gap-8">
      <PageHeader eyebrow={t("legalKicker")} title={doc.title} description={doc.summary} />
      <div className="-mt-4 grid gap-3">
        <p className="text-sm text-text-muted">
          {copy.legalVersion} <span className="tabular-nums">{GUIDE_AGREEMENT_VERSION}</span> · {copy.legalEffective}{" "}
          <time dateTime={GUIDE_AGREEMENT_VERSION}>
            {formatDate(locale, `${GUIDE_AGREEMENT_VERSION}T00:00:00Z`, { dateStyle: "long", timeZone: "UTC" })}
          </time>
        </p>
        {REVIEWED ? null : <Notice tone="warning">{copy.legalDraft}</Notice>}
      </div>
      {doc.sections.map((section) => (
        <section key={section.id} id={section.id} aria-labelledby={`${section.id}-h`} className="grid gap-3">
          <h2 id={`${section.id}-h`} className="title-card text-[1.25rem]">
            {section.heading}
          </h2>
          {section.body.map((block, index) =>
            typeof block === "string" ? (
              <p key={index} className="leading-relaxed text-text">
                {block}
              </p>
            ) : (
              <ul key={index} className="grid list-disc gap-2 ps-5 leading-relaxed">
                {block.list.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
