import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { RideRequestView } from "@/components/rides/ride-request-view";
import { ShellMain } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "Your ride — Mshwar", robots: { index: false, follow: false } };

export default async function RideRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ShellMain>
      <RequireAuth>
        <RideRequestView requestId={id} />
      </RequireAuth>
    </ShellMain>
  );
}
