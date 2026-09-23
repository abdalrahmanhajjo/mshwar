import { notFound } from "next/navigation";
import { ShellMain } from "@/components/shell/app-shell";
import { GuidePage } from "@/components/guide/guide-directory";
import { PublicGuideReviewsSection } from "@/components/guide/guide-reviews";
import { PublicTours } from "@/components/guide/public-tours";
import { loadGuide, loadGuideReviews, loadGuideTours } from "@/lib/guides-server";

export default async function GuideProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, tours, reviews] = await Promise.all([loadGuide(slug), loadGuideTours(slug), loadGuideReviews(slug)]);
  if (!guide) {
    notFound();
  }
  return (
    <ShellMain>
      <GuidePage guide={guide} />
      <PublicTours guide={guide} tours={tours} />
      <PublicGuideReviewsSection reviews={reviews} />
    </ShellMain>
  );
}
