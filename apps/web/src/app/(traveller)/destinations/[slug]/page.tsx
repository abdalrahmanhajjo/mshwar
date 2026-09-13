import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DestinationDetailView } from "@/components/browse/destination-detail-view";
import { DESTINATIONS, experiencesForDestination, getDestination } from "@/lib/catalog";

export function generateStaticParams() {
  return DESTINATIONS.map((destination) => ({ slug: destination.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const destination = getDestination(slug);
  if (!destination) {
    return { title: "Destination" };
  }
  return {
    title: `${destination.name}, at your own pace. — Mshwar`,
    description: destination.blurb,
  };
}

export default async function DestinationDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destination = getDestination(slug);
  if (!destination) {
    notFound();
  }
  return <DestinationDetailView destination={destination} experiences={experiencesForDestination(slug)} />;
}
