"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Building2,
  CalendarCheck,
  Download,
  FileText,
  RotateCcw,
  ShieldCheck,
  Ticket,
  UserX,
} from "lucide-react";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { useLocale } from "@/components/shell/locale-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { PageHeader } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { DEFAULT_POLICIES } from "@/lib/catalog";
import { useCheckoutCopy } from "@/lib/checkout-copy";
import { usePrivacyCopy } from "@/lib/privacy-copy";
import { cn, focusRing } from "@/lib/utils";

function capitalize(value: string) {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function LegalSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="grid scroll-mt-28 gap-5 border-t border-border-subtle pt-10"
    >
      <h2 id={`${id}-heading`} className="title-section text-[2rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function LegalLayout({
  label,
  sections,
  children,
}: {
  label: string;
  sections: { id: string; title: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[14rem_1fr] lg:gap-16">
      <nav aria-label={label} className="hidden lg:block">
        <ol className="sticky top-28 grid gap-1 border-s border-border-subtle">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={cn(
                  "-ms-px flex gap-3 border-s border-transparent py-2 ps-4 text-sm text-text-muted transition-colors hover:border-brand hover:text-text",
                  focusRing,
                )}
              >
                <span className="tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="grid max-w-3xl gap-12">{children}</div>
    </div>
  );
}

export function ContactView() {
  const { t } = useLocale();
  const cards = [
    {
      icon: Ticket,
      title: t("contactTravellersTitle"),
      body: t("contactTravellersBody"),
      href: "/bookings",
      cta: t("openBookings"),
    },
    {
      icon: Building2,
      title: t("contactBusinessTitle"),
      body: t("contactBusinessBody"),
      href: "/business",
      cta: t("openPortal"),
    },
    {
      icon: ShieldCheck,
      title: t("contactPrivacyTitle"),
      body: t("contactPrivacyBody"),
      href: "/settings#privacy",
      cta: t("openSettings"),
    },
  ];
  return (
    <ShellMain>
      <PageHeader eyebrow={t("contactKicker")} title={t("contactTitle")} description={t("contactBody")} />
      <ul className="grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <li
            key={card.href}
            className="flex flex-col gap-6 rounded-card border border-border-subtle bg-surface-raised p-7 shadow-sm"
          >
            <span className="grid size-12 place-items-center rounded-full bg-brand-subtle">
              <card.icon className="size-5" strokeWidth={1.6} aria-hidden />
            </span>
            <div className="grid gap-2">
              <h2 className="title-card text-[1.35rem]">{card.title}</h2>
              <p className="text-sm leading-relaxed text-text-muted">{card.body}</p>
            </div>
            <Button asChild variant="outline" className="mt-auto w-fit">
              <LocaleLink href={card.href}>
                {card.cta}
                <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
              </LocaleLink>
            </Button>
          </li>
        ))}
      </ul>
    </ShellMain>
  );
}

export function TermsView() {
  const { t, locale } = useLocale();
  const checkout = useCheckoutCopy();
  const browse = useBrowseCopy();
  const sections = [
    { id: "booking", title: t("termsBookingTitle") },
    { id: "preview", title: t("termsPreviewTitle") },
    { id: "policies", title: t("termsPoliciesTitle") },
  ];
  const modes = [
    { icon: CalendarCheck, title: checkout.modeInstant, body: checkout.confirmedNote },
    { icon: FileText, title: checkout.modeRequest, body: checkout.requestNote },
    { icon: Ticket, title: checkout.modeInquiry, body: checkout.inquiry },
  ];
  return (
    <ShellMain>
      <PageHeader eyebrow={t("legalKicker")} title={t("termsTitle")} description={t("termsBody")} />
      <LegalLayout label={t("legalKicker")} sections={sections}>
        <LegalSection id="booking" title={sections[0].title}>
          <ul className="grid gap-3 sm:grid-cols-3">
            {modes.map((mode) => (
              <li
                key={mode.title}
                className="grid content-start gap-3 rounded-card border border-border-subtle bg-surface-raised p-5"
              >
                <mode.icon className="size-5" strokeWidth={1.6} aria-hidden />
                <h3 className="font-semibold">{mode.title}</h3>
                <p className="text-sm leading-relaxed text-text-muted">{mode.body}</p>
              </li>
            ))}
          </ul>
          <p className="text-text-muted">{checkout.suggestionNote}</p>
        </LegalSection>
        <LegalSection id="preview" title={sections[1].title}>
          <Notice>{browse.sampleDisclaimer}</Notice>
          <p className="leading-relaxed text-text-muted">{browse.sampleOffer}</p>
        </LegalSection>
        <LegalSection id="policies" title={sections[2].title}>
          <dl className="grid gap-4" lang={locale === "en" ? undefined : "en"}>
            {DEFAULT_POLICIES.map((policy) => (
              <div key={policy.title} className="grid gap-1 border-b border-border-subtle pb-4 last:border-b-0">
                <dt className="font-semibold">{policy.title}</dt>
                <dd className="leading-relaxed text-text-muted">{policy.body}</dd>
              </div>
            ))}
          </dl>
        </LegalSection>
      </LegalLayout>
    </ShellMain>
  );
}

export function PrivacyPolicyView() {
  const { t } = useLocale();
  const privacy = usePrivacyCopy();
  const sections = [
    { id: "retention", title: privacy.retentionTitle },
    { id: "controls", title: t("privacyControlsTitle") },
  ];
  const controls = [
    { icon: Download, title: privacy.exportTitle, body: privacy.exportBody },
    { icon: RotateCcw, title: privacy.resetTitle, body: privacy.resetBody },
    { icon: UserX, title: privacy.deleteTitle, body: privacy.deleteBody },
  ];
  const retention = [
    privacy.retentionProfile,
    privacy.retentionTrips,
    privacy.retentionFavorites,
    privacy.retentionReviews,
    privacy.retentionBookings,
    privacy.retentionPayments,
  ];
  return (
    <ShellMain>
      <PageHeader eyebrow={t("legalKicker")} title={t("privacyPageTitle")} description={t("privacyPageBody")} />
      <LegalLayout label={t("legalKicker")} sections={sections}>
        <LegalSection id="retention" title={sections[0].title}>
          <p className="leading-relaxed text-text-muted">{privacy.privacyBody}</p>
          <ul className="grid gap-3">
            {retention.map((line) => {
              const [label, ...rest] = line.split(":");
              return (
                <li
                  key={line}
                  className="grid gap-1 rounded-control bg-surface-sunken px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
                >
                  <span className="font-semibold">{rest.length ? label : ""}</span>
                  <span className="text-text-muted">{rest.length ? capitalize(rest.join(":").trim()) : line}</span>
                </li>
              );
            })}
          </ul>
        </LegalSection>
        <LegalSection id="controls" title={sections[1].title}>
          <ul className="grid gap-3 sm:grid-cols-3">
            {controls.map((control) => (
              <li
                key={control.title}
                className="grid content-start gap-3 rounded-card border border-border-subtle bg-surface-raised p-5"
              >
                <control.icon className="size-5" strokeWidth={1.6} aria-hidden />
                <h3 className="font-semibold">{control.title}</h3>
                <p className="text-sm leading-relaxed text-text-muted">{control.body}</p>
              </li>
            ))}
          </ul>
          <Button asChild className="w-fit">
            <LocaleLink href="/settings#privacy">
              {t("openSettings")}
              <ArrowUpRight className="rtl:-scale-x-100" aria-hidden />
            </LocaleLink>
          </Button>
        </LegalSection>
      </LegalLayout>
    </ShellMain>
  );
}
