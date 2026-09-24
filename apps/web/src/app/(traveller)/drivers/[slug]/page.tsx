import type { Metadata } from "next";
import { DriverPageView } from "@/components/rides/driver-page-view";
import { ShellMain } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Verified driver — Mshwar" };

export default async function DriverPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <ShellMain>
      <DriverPageView slug={slug} />
    </ShellMain>
  );
}
