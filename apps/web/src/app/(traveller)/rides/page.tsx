import type { Metadata } from "next";
import { RequireAuth } from "@/components/auth/require-auth";
import { MyRides } from "@/components/rides/my-rides";
import { ShellMain } from "@/components/shell/app-shell";

export const metadata: Metadata = { title: "My rides — Mshwar", robots: { index: false, follow: false } };

export default function RidesPage() {
  return (
    <ShellMain>
      <RequireAuth>
        <MyRides />
      </RequireAuth>
    </ShellMain>
  );
}
