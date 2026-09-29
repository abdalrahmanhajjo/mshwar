import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CalendarRange,
  Footprints,
  HandCoins,
  Languages,
  PackagePlus,
  PencilRuler,
  Route,
  Sparkles,
  Star,
  UserRoundCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { EarningsCalculator } from "@/components/guide/join/earnings-calculator";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { FaqSection } from "@/components/seo/faq-section";
import { JsonLd } from "@/components/seo/json-ld";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { interpolate } from "@/i18n/catalogues";
import { guideJoinText, type GuideJoinKey } from "@/lib/guide-join-copy";
import { PLANNED_FEE_PERCENT } from "@/lib/guide-earnings";
import { loadFoundingProgramme } from "@/lib/guides-server";
import type { Locale } from "@/lib/locale";
import { seoText } from "@/lib/seo-copy";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { breadcrumbSchema, faqSchema, graph, organizationSchema, type Faq } from "@/lib/seo/schema";
import { cn, focusRing } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pathLocale();
  return buildMetadata({
    title: guideJoinText(locale, "metaTitle"),
    description: guideJoinText(locale, "metaDescription"),
    path: "/guides/join",
  });
}

const WHY: [LucideIcon, GuideJoinKey, GuideJoinKey][] = [
  [Sparkles, "why1Title", "why1Body"],
  [HandCoins, "why2Title", "why2Body"],
  [BadgeCheck, "why3Title", "why3Body"],
  [CalendarDays, "why4Title", "why4Body"],
  [Star, "why5Title", "why5Body"],
  [Languages, "why6Title", "why6Body"],
];

// Ways to earn: only what the product does today is marked available.
const WAYS: [LucideIcon, GuideJoinKey, GuideJoinKey, boolean][] = [
  [Route, "wayToursTitle", "wayToursBody", true],
  [UserRoundCheck, "wayHireTitle", "wayHireBody", true],
  [PencilRuler, "wayChangesTitle", "wayChangesBody", true],
  [Footprints, "wayHostTitle", "wayHostBody", true],
  [Users, "wayPrivateTitle", "wayPrivateBody", false],
  [PackagePlus, "wayAddonsTitle", "wayAddonsBody", false],
  [CalendarRange, "wayMultiTitle", "wayMultiBody", false],
  [Building2, "wayGroupsTitle", "wayGroupsBody", false],
];

const STEPS: [GuideJoinKey, GuideJoinKey][] = [
  ["step1Title", "step1Body"],
  ["step2Title", "step2Body"],
  ["step3Title", "step3Body"],
  ["step4Title", "step4Body"],
];

const FAQ_KEYS: [GuideJoinKey, GuideJoinKey][] = [
  ["faq1Q", "faq1A"],
  ["faq2Q", "faq2A"],
  ["faq3Q", "faq3A"],
  ["faq4Q", "faq4A"],
  ["faq5Q", "faq5A"],
  ["faq6Q", "faq6A"],
];

function Kicker({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.18em]",
        inverse ? "text-brand-foreground/70" : "text-text-muted",
      )}
    >
      <span className="size-1.5 rounded-full bg-accent" aria-hidden />
      {children}
    </p>
  );
}

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-balance text-[clamp(1.75rem,1.35rem+1.5vw,2.5rem)] font-[560] leading-[1.08] tracking-[-0.03em]"
    >
      {children}
    </h2>
  );
}

const applyLink = cn(
  "group inline-flex h-12 items-center gap-2 rounded-pill bg-accent px-6 text-[0.9375rem] font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90",
  focusRing,
);

function FoundingCard({ locale, remaining, limit }: { locale: Locale; remaining: number | null; limit: number }) {
  const t = (key: GuideJoinKey) => guideJoinText(locale, key);
  const status =
    remaining === null
      ? t("foundingLimited")
      : remaining > 0
        ? interpolate(t("foundingLeft"), { n: String(remaining), limit: String(limit) })
        : interpolate(t("foundingFull"), { limit: String(limit) });
  const share = remaining === null ? null : Math.round(((limit - remaining) / limit) * 100);
  return (
    <aside
      aria-labelledby="founding-title"
      className="grid gap-5 rounded-[1.75rem] bg-brand p-7 text-brand-foreground shadow-[0_40px_80px_-40px_rgb(18_53_47/0.6)] md:p-8"
    >
      <Kicker inverse>{t("foundingKicker")}</Kicker>
      <p id="founding-title" className="text-[2rem] font-semibold leading-[1.05] tracking-[-0.03em]">
        {t("foundingTitle")}
      </p>
      <p className="text-[0.975rem] leading-relaxed text-brand-foreground/80">{t("foundingBody")}</p>
      <div className="grid gap-2">
        {share !== null ? (
          <div className="h-2 overflow-hidden rounded-pill bg-brand-foreground/15" aria-hidden>
            <div className="h-full rounded-pill bg-accent" style={{ width: `${Math.max(share, 2)}%` }} />
          </div>
        ) : null}
        <p className="text-sm font-semibold" data-testid="founding-status">
          {status}
        </p>
      </div>
    </aside>
  );
}

/** Earn with Mshwar: why guides join, how they earn, what it costs, and how to start. */
export default async function GuideJoinPage() {
  const locale = await pathLocale();
  const t = (key: GuideJoinKey) => guideJoinText(locale, key);
  const programme = await loadFoundingProgramme();
  const faqs: Faq[] = FAQ_KEYS.map(([question, answer]) => ({ question: t(question), answer: t(answer) }));
  const crumbs = [
    { name: seoText(locale, "crumbHome"), path: "/" },
    { name: t("crumbGuides"), path: "/guides" },
    { name: t("crumbJoin"), path: "/guides/join" },
  ];

  return (
    <ShellMain className="gap-20 md:gap-28">
      <JsonLd data={graph(organizationSchema(), breadcrumbSchema(crumbs, locale), faqSchema(faqs))} />

      {/* Hero */}
      <section aria-labelledby="join-title" className="grid gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
        <div className="grid gap-6 lg:col-span-7">
          <Breadcrumbs crumbs={crumbs} label={seoText(locale, "crumbNav")} />
          <Kicker>{t("kicker")}</Kicker>
          <h1
            id="join-title"
            className="text-balance text-[clamp(2.5rem,1.8rem+3vw,4.25rem)] font-[560] leading-[0.98] tracking-[-0.045em]"
          >
            {t("titleLead")} <span className="text-serif text-brand">{t("titleAccent")}</span>
          </h1>
          <p className="max-w-xl text-[1.125rem] leading-relaxed text-text-muted">{t("body")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <LocaleLink href="/guide" className={applyLink}>
              {t("apply")}
              <ArrowRight
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100"
                aria-hidden
              />
            </LocaleLink>
            <a
              href="#calculator"
              className={cn(
                "inline-flex h-12 items-center rounded-pill border border-border px-6 text-[0.9375rem] font-semibold text-text transition-colors hover:border-brand/40",
                focusRing,
              )}
            >
              {t("seeEarnings")}
            </a>
          </div>
        </div>
        <div className="lg:col-span-5">
          <FoundingCard locale={locale} remaining={programme?.remaining ?? null} limit={programme?.limit ?? 50} />
        </div>
      </section>

      {/* Why */}
      <section aria-labelledby="join-why" className="grid gap-8">
        <div className="grid gap-3">
          <Kicker>{t("whyKicker")}</Kicker>
          <Heading id="join-why">{t("whyTitle")}</Heading>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {WHY.map(([Icon, title, body]) => (
            <li
              key={title}
              className="grid content-start gap-3 rounded-card border border-border-subtle bg-surface-raised p-6"
            >
              <span className="grid size-12 place-items-center rounded-[0.875rem] bg-brand-subtle text-brand">
                <Icon className="size-6" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className="text-[1.125rem] font-semibold tracking-[-0.015em]">{t(title)}</h3>
              <p className="leading-relaxed text-text-muted">{t(body)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Ways to earn */}
      <section aria-labelledby="join-ways" className="grid gap-8">
        <div className="grid gap-3">
          <Kicker>{t("waysKicker")}</Kicker>
          <Heading id="join-ways">{t("waysTitle")}</Heading>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WAYS.map(([Icon, title, body, live]) => (
            <li
              key={title}
              className={cn(
                "grid content-start gap-3 rounded-card border p-5",
                live ? "border-border-subtle bg-surface-raised" : "border-dashed border-border bg-surface",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon
                  className={cn("size-6", live ? "text-brand" : "text-text-muted")}
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span
                  className={cn(
                    "rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em]",
                    live ? "bg-success/10 text-success" : "bg-surface-sunken text-text-muted",
                  )}
                >
                  {live ? t("availableNow") : t("comingSoon")}
                </span>
              </div>
              <h3 className="text-[1.0625rem] font-semibold tracking-[-0.015em]">{t(title)}</h3>
              <p className="text-[0.9375rem] leading-relaxed text-text-muted">{t(body)}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Calculator */}
      <section
        id="calculator"
        aria-labelledby="join-calc"
        className="-mx-[var(--layout-gutter-mobile)] scroll-mt-24 rounded-none bg-brand px-[var(--layout-gutter-mobile)] py-12 text-brand-foreground sm:mx-0 sm:rounded-[1.75rem] sm:px-10 md:py-14"
      >
        <div className="grid gap-8">
          <div className="grid max-w-2xl gap-3">
            <Kicker inverse>{t("calcKicker")}</Kicker>
            <Heading id="join-calc">{t("calcTitle")}</Heading>
            <p className="leading-relaxed text-brand-foreground/80">{t("calcBody")}</p>
          </div>
          <EarningsCalculator />
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="join-steps" className="grid gap-8">
        <div className="grid gap-3">
          <Kicker>{t("stepsKicker")}</Kicker>
          <Heading id="join-steps">{t("stepsTitle")}</Heading>
        </div>
        <ol className="grid gap-4 md:grid-cols-4">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="grid content-start gap-3 border-t-2 border-accent pt-5">
              <span className="text-sm font-semibold tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-[1.125rem] font-semibold tracking-[-0.015em]">{t(title)}</h3>
              <p className="leading-relaxed text-text-muted">{t(body)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Tiers and fees */}
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-10">
        <section aria-labelledby="join-tiers" className="grid content-start gap-6">
          <div className="grid gap-3">
            <Kicker>{t("tiersKicker")}</Kicker>
            <Heading id="join-tiers">{t("tiersTitle")}</Heading>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-6">
              <h3 className="inline-flex items-center gap-2 text-[1.125rem] font-semibold">
                <BadgeCheck className="size-5 text-brand" aria-hidden />
                {t("tierLicensedTitle")}
              </h3>
              <p className="leading-relaxed text-text-muted">{t("tierLicensedBody")}</p>
            </div>
            <div className="grid gap-2 rounded-card border border-border-subtle bg-surface-raised p-6">
              <h3 className="inline-flex items-center gap-2 text-[1.125rem] font-semibold">
                <Footprints className="size-5 text-brand" aria-hidden />
                {t("tierHostTitle")}
              </h3>
              <p className="leading-relaxed text-text-muted">{t("tierHostBody")}</p>
            </div>
          </div>
        </section>
        <section aria-labelledby="join-fees" className="grid content-start gap-6">
          <div className="grid gap-3">
            <Kicker>{t("feesKicker")}</Kicker>
            <Heading id="join-fees">{t("feesTitle")}</Heading>
          </div>
          <dl className="grid gap-3">
            {(
              [
                ["feeFoundingLabel", "0%", "feeFoundingNote", true],
                ["feeNowLabel", "0%", "feeNowNote", false],
                ["feeLaterLabel", `${PLANNED_FEE_PERCENT}%`, "feeLaterNote", false],
              ] as [GuideJoinKey, string, GuideJoinKey, boolean][]
            ).map(([label, value, note, highlight]) => (
              <div
                key={label}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 rounded-card border p-5",
                  highlight ? "border-accent/40 bg-accent/5" : "border-border-subtle bg-surface-raised",
                )}
              >
                <dt className="font-semibold">{t(label)}</dt>
                <dd className="row-span-2 text-[2rem] font-semibold tabular-nums tracking-[-0.03em] text-brand">
                  {value}
                </dd>
                <dd className="text-sm text-text-muted">{t(note)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <FaqSection id="join-faq" title={t("faqTitle")} faqs={faqs} />

      {/* Call to action */}
      <section
        aria-labelledby="join-cta"
        className="grid gap-6 rounded-[1.75rem] border border-border-subtle bg-surface-raised p-8 text-center md:p-12"
      >
        <Heading id="join-cta">{t("ctaTitle")}</Heading>
        <p className="text-[1.0625rem] text-text-muted">{t("ctaBody")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <LocaleLink href="/guide" className={applyLink}>
            {t("apply")}
            <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden />
          </LocaleLink>
          <LocaleLink
            href="/guides"
            className={cn(
              "inline-flex h-12 items-center rounded-pill px-5 text-[0.9375rem] font-semibold text-text underline decoration-border underline-offset-[6px] hover:decoration-text",
              focusRing,
            )}
          >
            {t("ctaDirectory")}
          </LocaleLink>
        </div>
      </section>
    </ShellMain>
  );
}
