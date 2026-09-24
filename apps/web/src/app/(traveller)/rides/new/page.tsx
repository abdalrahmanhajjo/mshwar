import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/components/auth/require-auth";
import { NewRideForm } from "@/components/rides/new-ride-form";
import { ShellMain } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "Ask verified drivers for a price — Mshwar",
  robots: { index: false, follow: false },
};

export default function NewRidePage() {
  return (
    <ShellMain>
      <RequireAuth>
        <Suspense>
          <NewRideForm />
        </Suspense>
      </RequireAuth>
    </ShellMain>
  );
}
