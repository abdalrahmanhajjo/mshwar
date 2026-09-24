"use client";

import { PartnerShell } from "@/components/shell/app-shell";
import { CHANGER_NAV, DRIVER_NAV } from "@/components/shell/nav-config";

// Navigation items carry icon components, which cannot cross from a server layout
// into a client shell, so the partner portals pick their navigation here.
export function DriverShell({ children }: { children: React.ReactNode }) {
  return <PartnerShell items={DRIVER_NAV}>{children}</PartnerShell>;
}

export function ChangerShell({ children }: { children: React.ReactNode }) {
  return <PartnerShell items={CHANGER_NAV}>{children}</PartnerShell>;
}
