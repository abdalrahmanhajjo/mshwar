import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperienceDetailView } from "@/components/browse/experience-detail-view";
import { JsonLd } from "@/components/seo/json-ld";
import { loadDestination, loadExperience, loadRelated } from "@/lib/catalogue-api";
import { EXPERIENCES } from "@/lib/catalog";
import { loadPlaceContributors } from "@/lib/guides-server";
import { seoText } from "@/lib/seo-copy";
import { crumbsFor } from "@/lib/seo/content";
import { buildMetadata, pathLocale } from "@/lib/seo/metadata";
import { breadcrumbSchema, experienceSchema, graph } from "@/lib/seo/schema";

export function generateStaticParams() {
  return EXPERIENCES.map((experience) => ({ slug: experience.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const experience = await loadExperience(slug);
  if (!experience) {
    return { title: "Experience" };
  }
  const locale = await pathLocale();
  const [place] = experience.placeLabel.split(" · ");
  return buildMetadata({
    title: place ? seoText(locale, "expTitle", { title: experience.title, place }) : `${experience.title} — Mshwar`,
    description: experience.summary || experience.body,
    path: `/experiences/${experience.slug}`,
    image: experience.image,
    imageAlt: experience.imageAlt,
  });
}

export default async function ExperienceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [experience, locale] = await Promise.all([loadExperience(slug), pathLocale()]);
  if (!experience) {
    notFound();
  }
  const [related, contributors, destination] = await Promise.all([
    loadRelated(slug),
    loadPlaceContributors(slug),
    loadDestination(experience.destinationSlug),
  ]);
  // Places sit under their destination: Home › Destinations › Byblos › this place.
  const crumbs = crumbsFor(
    locale,
    destination
      ? [
          { key: "crumbDestinations", path: "/destinations" },
          { name: destination.name, path: `/destinations/${destination.slug}` },
          { name: experience.title, path: `/experiences/${experience.slug}` },
        ]
      : [
          { key: "crumbExperiences", path: "/experiences" },
          { name: experience.title, path: `/experiences/${experience.slug}` },
        ],
  );
  return (
    <>
      <JsonLd data={graph(experienceSchema(experience, destination, locale), breadcrumbSchema(crumbs, locale))} />
      <ExperienceDetailView
        experience={experience}
        related={related}
        contributors={contributors}
        crumbs={crumbs}
        crumbLabel={seoText(locale, "crumbNav")}
      />
    </>
  );
}
