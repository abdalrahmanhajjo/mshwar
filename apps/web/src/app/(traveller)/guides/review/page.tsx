import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { ShellMain } from "@/components/shell/app-shell";
import { TravellerGuideReviews } from "@/components/guide/guide-reviews";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function TravellerGuideReviewPage() {
  return (
    <ShellMain>
      <RequireAuth>
        <TravellerGuideReviews />
      </RequireAuth>
    </ShellMain>
  );
}
