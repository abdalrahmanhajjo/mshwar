import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bot,
  CalendarDays,
  ClipboardCheck,
  Compass,
  Heart,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  MapPinned,
  Route,
  ScrollText,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Tags,
  Ticket,
  Users,
} from "lucide-react";
import type { MessageKey } from "@/lib/messages";

export type ShellSurface = "traveller" | "guide" | "admin";

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

// The business portal is hidden while Mshwar works supply-side through guides (it
// stays in the codebase behind NEXT_PUBLIC_BUSINESS_PORTAL). Guides get this instead.
export const GUIDE_NAV: ShellNavItem[] = [
  { href: "/guide", labelKey: "guideHome", icon: LayoutDashboard, exact: true },
  { href: "/guide/requests", labelKey: "guideRequests", icon: Inbox },
  { href: "/guide/tours", labelKey: "guideTours", icon: Route },
  { href: "/guide/calendar", labelKey: "guideCalendar", icon: CalendarDays },
  { href: "/guide/contribute", labelKey: "guideContribute", icon: MapPinned },
];

export const ADMIN_NAV: ShellNavItem[] = [
  { href: "/admin", labelKey: "overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", labelKey: "users", icon: Users },
  { href: "/admin/roles", labelKey: "adminRoles", icon: KeyRound },
  { href: "/admin/guides", labelKey: "guideQueue", icon: ShieldCheck },
  { href: "/admin/proposals", labelKey: "placeProposals", icon: MapPinned },
  { href: "/admin/moderation", labelKey: "moderation", icon: Shield },
  { href: "/admin/bookings", labelKey: "adminBookings", icon: Ticket },
  { href: "/admin/taxonomy", labelKey: "taxonomy", icon: Tags },
  { href: "/admin/cases", labelKey: "supportCases", icon: LifeBuoy },
  { href: "/admin/quality", labelKey: "dataQuality", icon: ClipboardCheck },
  { href: "/admin/notifications", labelKey: "notificationHealth", icon: Bell },
  { href: "/admin/audit", labelKey: "auditLog", icon: ScrollText },
  { href: "/admin/settings", labelKey: "settings", icon: Settings },
  { href: "/admin/collections", labelKey: "collections", icon: Sparkles },
  { href: "/admin/planner", labelKey: "plannerHealth", icon: Bot },
];

export const NAV_BY_SURFACE: Record<ShellSurface, ShellNavItem[]> = {
  traveller: TRAVELLER_NAV,
  guide: GUIDE_NAV,
  admin: ADMIN_NAV,
};

export function isNavActive(pathname: string, item: ShellNavItem) {
  const current = pathname.replace(/^\/(en|ar|fr)(?=\/|$)/, "") || "/";
  if (item.exact) {
    return current === item.href;
  }
  return current === item.href || current.startsWith(`${item.href}/`);
}
