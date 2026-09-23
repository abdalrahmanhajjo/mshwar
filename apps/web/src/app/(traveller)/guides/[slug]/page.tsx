import { notFound } from "next/navigation";
import { ShellMain } from "@/components/shell/app-shell";
import { GuidePage } from "@/components/guide/guide-directory";
import { loadGuide } from "@/lib/guides-server";

export default async function GuideProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await loadGuide(slug);
  if (!guide) {
    notFound();
  }
  return (
    <ShellMain>
      <GuidePage guide={guide} />
    </ShellMain>
  );
}
