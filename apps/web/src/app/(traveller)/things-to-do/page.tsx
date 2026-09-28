import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { LinkCards } from "@/components/seo/link-cards";
import { ShellMain } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/ui/page-header";
import { seoText } from "@/lib/seo-copy";
import { crumbsFor } from "@/lib/seo/content";
import { thingCards } from "@/lib/seo/hub-data";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { breadcrumbSchema, graph } from "@/lib/seo/schema";
import { siteUrl } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await pathLocale();
  return buildMetadata({
    title: seoText(locale, "thingsTitle"),
    description: seoText(locale, "thingsDescription"),
    path: "/things-to-do",
  });
}

export default async function ThingsToDoPage() {
  const locale = await pathLocale();
  const cards = await thingCards(locale);
  const crumbs = crumbsFor(locale, [{ key: "crumbThingsToDo", path: "/things-to-do" }]);
  return (
    <ShellMain className="gap-10">
      <JsonLd
        data={graph(breadcrumbSchema(crumbs, locale), {
          "@type": "CollectionPage",
          name: seoText(locale, "thingsH1"),
          url: siteUrl("/things-to-do", locale),
          about: { "@type": "Country", name: "Lebanon" },
          hasPart: cards.map((card) => ({
            "@type": "CollectionPage",
            name: card.title,
            url: siteUrl(card.href, locale),
          })),
        })}
      />
      <Breadcrumbs crumbs={crumbs} label={seoText(locale, "crumbNav")} />
      <PageHeader title={seoText(locale, "thingsH1")} description={seoText(locale, "thingsIntro")} />
      <LinkCards cards={cards} />
    </ShellMain>
  );
}
