import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Compass,
  Heart,
  LayoutDashboard,
  MapPin,
  Route,
  Settings,
  Shield,
  Sparkles,
  Store,
  Ticket,
  Users,
  Wallet,
} from "lucide-react";
import type { MessageKey } from "@/lib/messages";

export type ShellSurface = "traveller" | "business" | "admin";

export interface ShellNavItem {
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  exact?: boolean;
}

export const TRAVELLER_NAV: ShellNavItem[] = [
  { href: "/", labelKey: "discover", icon: Compass, exact: true },
  { href: "/destinations", labelKey: "destinations", icon: MapPin },
  { href: "/experiences", labelKey: "experiences", icon: Sparkles },
  { href: "/plan", labelKey: "planATrip", icon: Route },
  { href: "/trips", labelKey: "myTrips", icon: Heart },
];

export const BUSINESS_NAV: ShellNavItem[] = [
  { href: "/business", labelKey: "dashboard", icon: LayoutDashboard, exact: true },
  { href: "/business/listings", labelKey: "listings", icon: Store },
  { href: "/business/bookings", labelKey: "bookings", icon: Ticket },
  { href: "/business/finance", labelKey: "finance", icon: Wallet },
  { href: "/business/team", labelKey: "team", icon: Users },
];

export const ADMIN_NAV: ShellNavItem[] = [
  { href: "/admin", labelKey: "overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", labelKey: "users", icon: Users },
  { href: "/admin/businesses", labelKey: "businesses", icon: Building2 },
  { href: "/admin/moderation", labelKey: "moderation", icon: Shield },
  { href: "/admin/settings", labelKey: "settings", icon: Settings },
];

export const NAV_BY_SURFACE: Record<ShellSurface, ShellNavItem[]> = {
  traveller: TRAVELLER_NAV,
  business: BUSINESS_NAV,
  admin: ADMIN_NAV,
};

export function isNavActive(pathname: string, item: ShellNavItem) {
  const current = pathname.replace(/^\/(en|ar|fr)(?=\/|$)/, "") || "/";
  if (item.exact) {
    return current === item.href;
  }
  return current === item.href || current.startsWith(`${item.href}/`);
}
