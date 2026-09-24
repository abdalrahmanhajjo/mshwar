"use client";

import { BadgeCheck, ClipboardCheck, LayoutDashboard, Settings, Store, Ticket, Users, Wallet } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import type { ShellNavItem } from "@/components/shell/nav-config";

// Kept out of the shared nav registry on purpose: the business portal only renders
// when NEXT_PUBLIC_BUSINESS_PORTAL is on, and nothing else should link to it.
const LEGACY_BUSINESS_NAV: ShellNavItem[] = [
  { href: "/business", labelKey: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/business/listings", labelKey: "listings", icon: Store },
  { href: "/business/claims", labelKey: "listingClaims", icon: BadgeCheck },
  { href: "/business/bookings", labelKey: "bookings", icon: Ticket },
  { href: "/business/reviews", labelKey: "reviews", icon: ClipboardCheck },
  { href: "/business/finance", labelKey: "finance", icon: Wallet },
  { href: "/business/team", labelKey: "team", icon: Users },
  { href: "/business/settings", labelKey: "settings", icon: Settings },
];

export function LegacyBusinessShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell surface="guide" items={LEGACY_BUSINESS_NAV} surfaceLabel="businessSurface">
      {children}
    </AppShell>
  );
}
