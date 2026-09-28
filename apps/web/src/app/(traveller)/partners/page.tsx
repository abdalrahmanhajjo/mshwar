import type { Metadata } from "next";
import { BadgeSnippet } from "@/components/seo/badge-snippet";
import { ShellMain } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { seoText } from "@/lib/seo-copy";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pathLocale();
  return buildMetadata({
    title: seoText(locale, "badgeTitle"),
    description: seoText(locale, "badgeBody"),
    path: "/partners",
  });
}

/** The "Find us on Mshwar" badge: how listed places, guides and drivers link back. */
export default async function PartnersBadgePage() {
  const locale = await pathLocale();
  return (
    <ShellMain className="max-w-3xl gap-10">
      <PageHeader title={seoText(locale, "badgeH1")} description={seoText(locale, "badgeBody")} />
      <BadgeSnippet
        copy={{
          urlLabel: seoText(locale, "badgeUrlLabel"),
          urlHint: seoText(locale, "badgeUrlHint"),
          urlError: seoText(locale, "badgeUrlError"),
          styleLabel: seoText(locale, "badgeStyleLabel"),
          light: seoText(locale, "badgeLight"),
          dark: seoText(locale, "badgeDark"),
          codeLabel: seoText(locale, "badgeCodeLabel"),
          copy: seoText(locale, "badgeCopy"),
          copied: seoText(locale, "badgeCopied"),
          preview: seoText(locale, "badgePreview"),
        }}
      />
    </ShellMain>
  );
}
