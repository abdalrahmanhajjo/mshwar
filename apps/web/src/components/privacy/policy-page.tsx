"use client";
import { useLocale } from "@/components/shell/locale-provider";
import { LocaleLink } from "@/components/shell/locale-link";
import { policies, type PolicyKind } from "@/lib/legal-copy";
import { POLICY_VERSION } from "@/lib/security";

export function PolicyPage({ kind }: { kind: PolicyKind }) {
  const { locale } = useLocale();
  const policy = policies[locale][kind];
  return <article className="mx-auto max-w-3xl space-y-8 py-8">
    <header><h1 className="text-3xl font-semibold">{policy.title}</h1><p className="mt-3 text-text-muted">{locale === "ar" ? "نسخة التجربة الأولية" : locale === "fr" ? "Version pilote" : "Pilot version"} · <time dateTime={POLICY_VERSION}>{POLICY_VERSION}</time></p></header>
    {policy.sections.map(section => <section key={section.title} className="space-y-3"><h2 className="text-xl font-semibold">{section.title}</h2><p className="leading-7 text-text-muted">{section.body}</p></section>)}
    <nav className="flex flex-wrap gap-4" aria-label={policy.title}>
      {(Object.keys(policies[locale]) as PolicyKind[]).map(key => <LocaleLink className="underline" key={key} href={`/${key === "community" ? "community-guidelines" : key}`}>{policies[locale][key].title}</LocaleLink>)}
    </nav>
  </article>;
}
