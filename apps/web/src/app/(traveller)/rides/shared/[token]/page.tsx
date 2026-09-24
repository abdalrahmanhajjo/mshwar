import type { Metadata } from "next";
import { SharedRideView } from "@/components/rides/shared-ride-view";
import { ShellMain } from "@/components/shell/app-shell";

// A share link is private to whoever was sent it: never indexed, never sent on as a referrer.
export const metadata: Metadata = {
  title: "A shared ride — Mshwar",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function SharedRidePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <ShellMain>
      <SharedRideView token={token} />
    </ShellMain>
  );
}
