import type { Metadata } from "next";
import { Suspense } from "react";
import { DriverDirectory } from "@/components/rides/driver-directory";
import { ShellMain } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: "Verified drivers in Lebanon — Mshwar",
  description:
    "Licensed red-plate drivers whose documents Mshwar checked with the issuer. Ask for a fixed price and pay in the car.",
};

export default function DriversPage() {
  return (
    <ShellMain>
      <Suspense>
        <DriverDirectory />
      </Suspense>
    </ShellMain>
  );
}
