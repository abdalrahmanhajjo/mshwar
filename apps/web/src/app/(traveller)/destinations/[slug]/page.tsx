import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DestinationDetailView } from "@/components/browse/destination-detail-view";
import { JsonLd } from "@/components/seo/json-ld";
import { DestinationTours } from "@/components/tours/destination-tours";
import { loadDestination, loadDestinations, loadExperiencePage } from "@/lib/catalogue-api";
import { DESTINATIONS, type Destination } from "@/lib/catalog";
import { seoText } from "@/lib/seo-copy";
import { publishedGuide } from "@/content/destination-guides";
import { loadDestinationTours } from "@/lib/guides-server";
import { crumbsFor, destinationFaqs, guideBlock, guideFaqs } from "@/lib/seo/content";
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
    description:
      publishedGuide(destination.slug)?.overview[locale === "ar" ? "ar" : "en"][0] ||
      destination.blurb ||
      seoText(locale, "destDescription", values),
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
  const [page, tours] = await Promise.all([
    loadExperiencePage({ destination: slug, pageSize: 24 }),
    loadDestinationTours(slug),
  ]);
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
  const guide = publishedGuide(destination.slug);
  const faqs = [...destinationFaqs(locale, destination, page.items), ...guideFaqs(locale, destination, guide)];
  const block = guideBlock(locale, destination, guide);

  return (
    <>
      <JsonLd
        data={graph(
          destinationSchema(
            block ? { ...destination, blurb: block.paragraphs.join(" ") } : destination,
            page.items,
            locale,
          ),
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
        guide={block}
        faqTitle={seoText(locale, "faqHeading")}
        tours={<DestinationTours tours={tours} name={destination.name} slug={destination.slug} locale={locale} />}
      />
    </>
  );
}
