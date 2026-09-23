import { notFound } from "next/navigation";
import { ShellMain } from "@/components/shell/app-shell";
import { GuidePage } from "@/components/guide/guide-directory";
import { PublicTours } from "@/components/guide/public-tours";
import { loadGuide, loadGuideTours } from "@/lib/guides-server";

export default async function GuideProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, tours] = await Promise.all([loadGuide(slug), loadGuideTours(slug)]);
  if (!guide) {
    notFound();
  }
  return (
    <ShellMain>
      <GuidePage guide={guide} />
      <PublicTours guide={guide} tours={tours} />
    </ShellMain>
  );
}
