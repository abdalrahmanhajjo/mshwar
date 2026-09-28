import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { ShellMain } from "@/components/shell/app-shell";
import { LocaleLink } from "@/components/shell/locale-link";
import { Button } from "@/components/ui/button";
import { seoText, type SeoKey } from "@/lib/seo-copy";
import { crumbsFor } from "@/lib/seo/content";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { breadcrumbSchema, graph, organizationSchema } from "@/lib/seo/schema";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pathLocale();
  return buildMetadata({
    title: seoText(locale, "aboutTitle"),
    description: seoText(locale, "aboutDescription"),
    path: "/about",
  });
}

const SECTIONS: [SeoKey, SeoKey][] = [
  ["aboutWhatTitle", "aboutWhatBody"],
  ["aboutDataTitle", "aboutDataBody"],
  ["aboutWhoTitle", "aboutWhoBody"],
];

/** Who runs Mshwar and how its information works: the trust page search engines look for. */
export default async function AboutPage() {
  const locale = await pathLocale();
  const crumbs = crumbsFor(locale, [{ key: "crumbAbout", path: "/about" }]);
  return (
    <ShellMain className="max-w-4xl gap-10">
      <JsonLd
        data={graph(
          organizationSchema(),
          {
            "@type": "AboutPage",
            name: seoText(locale, "aboutH1"),
            url: siteUrl("/about", locale),
            inLanguage: locale,
            mainEntity: { "@id": organizationSchema()["@id"] },
          },
          breadcrumbSchema(crumbs, locale),
        )}
      />
      <Breadcrumbs crumbs={crumbs} label={seoText(locale, "crumbNav")} />
      <div className="grid gap-5">
        <h1 className="title-page">{seoText(locale, "aboutH1")}</h1>
        <p className="text-lg leading-relaxed text-text-muted">{seoText(locale, "aboutLead")}</p>
      </div>
      {SECTIONS.map(([title, body]) => (
        <section key={title} className="grid gap-3">
          <h2 className="title-card text-[1.5rem]">{seoText(locale, title)}</h2>
          <p className="leading-relaxed text-text-muted">{seoText(locale, body)}</p>
        </section>
      ))}
      <Button asChild className="w-fit">
        <LocaleLink href="/contact">
          {seoText(locale, "aboutContact")}
          <ArrowRight className="rtl:-scale-x-100" aria-hidden />
        </LocaleLink>
      </Button>
    </ShellMain>
  );
}
