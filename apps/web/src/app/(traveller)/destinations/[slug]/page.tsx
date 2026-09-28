import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DestinationDetailView } from "@/components/browse/destination-detail-view";
import { JsonLd } from "@/components/seo/json-ld";
import { loadDestination, loadDestinations, loadExperiencePage } from "@/lib/catalogue-api";
import { DESTINATIONS, type Destination } from "@/lib/catalog";
import { seoText } from "@/lib/seo-copy";
import { crumbsFor, destinationFaqs } from "@/lib/seo/content";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { breadcrumbSchema, destinationSchema, faqSchema, graph } from "@/lib/seo/schema";

export function generateStaticParams() {
  return DESTINATIONS.map((destination) => ({ slug: destination.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const destination = await loadDestination(slug);
  if (!destination) {
    return { title: "Destination" };
  }
  const locale = await pathLocale();
  const values = { name: destination.name, region: destination.region };
  return buildMetadata({
    title: seoText(locale, "destTitle", values),
    description: destination.blurb || seoText(locale, "destDescription", values),
    path: `/destinations/${destination.slug}`,
    image: destination.image,
    imageAlt: destination.imageAlt,
  });
}

/** The governorate a town sits in, when the catalogue has it as its own destination. */
function parentRegion(destination: Destination, all: Destination[]): Destination | undefined {
  if (destination.region === destination.name) return undefined;
  return all.find((item) => item.name === destination.region && item.region === item.name);
}

export default async function DestinationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [destination, all, locale] = await Promise.all([loadDestination(slug), loadDestinations(), pathLocale()]);
  if (!destination) {
    notFound();
  }
  const page = await loadExperiencePage({ destination: slug, pageSize: 24 });
  const parent = parentRegion(destination, all);
  const crumbs = crumbsFor(locale, [
    { key: "crumbDestinations", path: "/destinations" },
    ...(parent ? [{ name: parent.name, path: `/destinations/${parent.slug}` }] : []),
    { name: destination.name, path: `/destinations/${destination.slug}` },
  ]);
  // Same governorate: the region's towns, or a town's neighbours and its region.
  const related = all
    .filter((item) => item.slug !== destination.slug && item.region === destination.region)
    .slice(0, 8);
  const faqs = destinationFaqs(locale, destination, page.items);

  return (
    <>
      <JsonLd
        data={graph(
          destinationSchema(destination, page.items, locale),
          breadcrumbSchema(crumbs, locale),
          faqSchema(faqs),
        )}
      />
      <DestinationDetailView
        destination={destination}
        experiences={page.items}
        crumbs={crumbs}
        crumbLabel={seoText(locale, "crumbNav")}
        related={related}
        relatedTitle={seoText(locale, "destRelatedTitle", { region: destination.region })}
        faqs={faqs}
        faqTitle={seoText(locale, "faqHeading")}
      />
    </>
  );
}
