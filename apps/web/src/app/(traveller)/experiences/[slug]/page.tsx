import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperienceDetailView } from "@/components/browse/experience-detail-view";
import { EXPERIENCES, getExperience, relatedExperiences } from "@/lib/catalog";

export function generateStaticParams() {
  return EXPERIENCES.map((experience) => ({ slug: experience.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const experience = getExperience(slug);
  if (!experience) {
    return { title: "Experience" };
  }
  return {
    title: `${experience.title} — Mshwar`,
    description: experience.body,
  };
}

export default async function ExperienceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const experience = getExperience(slug);
  if (!experience) {
    notFound();
  }
  return <ExperienceDetailView experience={experience} related={relatedExperiences(slug)} />;
}
