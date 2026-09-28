"use client";

import { LocaleLink } from "@/components/shell/locale-link";
import { ArrowUpRight } from "lucide-react";
import { cn, focusRing } from "@/lib/utils";
import { Wordmark } from "@/components/shell/brand-mark";
import { Eyebrow } from "@/components/ui/page-header";
import { useBrowseCopy } from "@/lib/browse-copy";
import { useLocalCopy } from "@/lib/local-copy";
import { usePartnerCopy } from "@/lib/partner-copy";
import { useLocale } from "@/components/shell/locale-provider";
import { CookieSettingsButton } from "@/components/legal/cookie-consent";
import { useTrustCopy } from "@/lib/trust-copy";
import { useHomeCopy } from "@/lib/home-copy";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { splitAtQuote } from "@/lib/text";
import type { ShellSurface } from "@/components/shell/nav-config";
import { seoText } from "@/lib/seo-copy";

const FOOTER_COPY: Record<ShellSurface, "travellerFooter" | "guideFooter" | "adminFooter" | "partnerFooter"> = {
  traveller: "travellerFooter",
  guide: "guideFooter",
  admin: "adminFooter",
  partner: "partnerFooter",
};

// On phones each link is a 40px-tall row, so a thumb lands on the right one.
const linkClass = cn(
  "inline-flex min-h-10 items-center rounded-sm text-text transition-colors hover:text-text/60 md:min-h-0",
  focusRing,
);
const legalLink = cn("inline-flex min-h-10 items-center hover:text-text md:min-h-0", focusRing);

export function ShellFooter({ surface }: { surface: ShellSurface }) {
  const { t, locale } = useLocale();
  const copy = useBrowseCopy();
  const local = useLocalCopy();
  const partner = usePartnerCopy();
  const trust = useTrustCopy();
  const home = useHomeCopy();

  if (surface !== "traveller") {
    return (
      <footer className="mt-auto border-t border-border-subtle">
        <div className="shell-gutter flex flex-col gap-3 py-5 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Mshwar · {t(FOOTER_COPY[surface])}</p>
          <nav aria-label={t("contact")} className="flex flex-wrap gap-4">
            <LocaleLink href="/privacy" className={cn("hover:text-text", focusRing)}>
              {t("privacy")}
            </LocaleLink>
            <LocaleLink href="/terms" className={cn("hover:text-text", focusRing)}>
              {t("terms")}
            </LocaleLink>
            <LocaleLink href="/cancellation-policy" className={cn("hover:text-text", focusRing)}>
              {trust.cancellationLink}
            </LocaleLink>
            <LocaleLink href="/community-guidelines" className={cn("hover:text-text", focusRing)}>
              {trust.communityLink}
            </LocaleLink>
            <CookieSettingsButton />
            <LocaleLink href="/contact" className={cn("hover:text-text", focusRing)}>
              {t("contact")}
            </LocaleLink>
          </nav>
        </div>
      </footer>
    );
  }

  const [lead, quoted] = splitAtQuote(copy.yallaTitle);

  const groups = [
    {
      title: home.footerExplore,
      links: [
        { href: "/lebanon", label: seoText(locale, "footerGuide") },
        { href: "/destinations", label: t("destinations") },
        { href: "/things-to-do", label: seoText(locale, "thingsH1") },
        { href: "/collections", label: copy.tripIdeas },
      ],
    },
    {
      title: home.footerPlan,
      links: [
        { href: "/plan", label: copy.planATrip },
        { href: "/trips", label: t("myTrips") },
        { href: "/drivers", label: local.driversTitle },
      ],
    },
    {
      title: home.footerWork,
      links: [
        { href: "/guide", label: t("forGuides") },
        { href: "/drive", label: partner.driveKicker },
        { href: "/exchange", label: partner.exchangeTitle },
        { href: "/partners", label: seoText(locale, "footerBadge") },
      ],
    },
    {
      title: home.footerHelp,
      links: [
        { href: "/about", label: seoText(locale, "footerAbout") },
        { href: "/contact", label: copy.helpCenter },
        { href: "/cancellation-policy", label: trust.cancellationLink },
        { href: "/community-guidelines", label: trust.communityLink },
      ],
    },
  ];

  return (
    <footer className="mt-auto">
      <div className="shell-frame">
        <div className="flex flex-col items-start justify-between gap-8 border-t border-border-subtle py-14 md:flex-row md:items-center md:py-16">
          <div className="grid gap-4">
            <Eyebrow>{copy.yallaKicker}</Eyebrow>
            <h2 className="max-w-2xl text-balance text-[clamp(2rem,1.4rem+2vw,3.25rem)] font-[560] leading-[1.02] tracking-[-0.04em] text-text">
              {lead} <span className="text-serif">{quoted}</span>
            </h2>
          </div>
          {/* A labelled, full-width button on phones; the round arrow from md up. */}
          <LocaleLink
            href="/plan"
            className={cn(
              "group inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-6 text-brand-foreground transition-colors duration-200 hover:bg-brand/90 md:size-16 md:px-0",
              focusRing,
            )}
          >
            <span className="text-[0.9375rem] font-semibold md:sr-only">{copy.planATrip}</span>
            <ArrowUpRight
              className="size-6 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100"
              aria-hidden
            />
          </LocaleLink>
        </div>
      </div>
      <div className="bg-surface-sunken">
        <div className="shell-frame grid gap-10 py-12 md:py-14 lg:grid-cols-12 lg:gap-8">
          <div className="grid content-start gap-4 lg:col-span-4">
            <Wordmark className="text-[2rem]" />
            <p className="max-w-xs text-sm text-text-muted">{copy.footerPace}</p>
            <div className="grid w-fit gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                {home.footerLanguage}
              </span>
              <LanguageSwitcher compact />
            </div>
          </div>
          <nav aria-label={home.footerNav} className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 lg:col-span-8">
            {groups.map((group) => (
              <div key={group.title} className="grid content-start gap-1.5 md:gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">{group.title}</p>
                <ul className="grid text-sm md:gap-2.5">
                  {group.links.map((item) => (
                    <li key={`${item.href}-${item.label}`}>
                      <LocaleLink href={item.href} className={linkClass}>
                        {item.label}
                      </LocaleLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="shell-frame">
          <div className="flex flex-col gap-4 border-t border-border-subtle py-6 text-xs text-text-muted lg:flex-row lg:items-center lg:justify-between">
            <p>© 2026 Mshwar · {copy.sampleDisclaimer}</p>
            <div className="flex flex-wrap items-center gap-x-5 md:gap-y-2">
              <LocaleLink href="/privacy" className={legalLink}>
                {t("privacy")}
              </LocaleLink>
              <LocaleLink href="/terms" className={legalLink}>
                {t("terms")}
              </LocaleLink>
              <CookieSettingsButton className="inline-flex min-h-10 items-center md:min-h-0" />
              <LocaleLink href="/privacy" className={legalLink}>
                {copy.photoCredits}
              </LocaleLink>
              <LocaleLink href="/contact" className={legalLink}>
                {t("contact")}
              </LocaleLink>
              <LocaleLink href="/admin" className={cn(legalLink, "gap-1")}>
                {copy.operations}
                <ArrowUpRight className="size-3 rtl:-scale-x-100" aria-hidden />
              </LocaleLink>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
