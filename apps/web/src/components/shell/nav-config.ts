import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  Bell,
  BusFront,
  Car,
  UtensilsCrossed,
  Bot,
  Languages,
  Sprout,
  CalendarDays,
  ClipboardCheck,
  Compass,
  Filter,
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
  Star,
  Tags,
  Ticket,
  Users,
} from "lucide-react";
import type { MessageKey } from "@/lib/messages";

export type ShellSurface = "traveller" | "guide" | "admin" | "partner";

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
  { href: "/guide/reviews", labelKey: "guideReviews", icon: Star },
  { href: "/guide/help", labelKey: "guideHelp", icon: LifeBuoy },
];

export const ADMIN_NAV: ShellNavItem[] = [
  { href: "/admin", labelKey: "overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", labelKey: "users", icon: Users },
  { href: "/admin/roles", labelKey: "adminRoles", icon: KeyRound },
  { href: "/admin/guides", labelKey: "guideQueue", icon: ShieldCheck },
  { href: "/admin/proposals", labelKey: "placeProposals", icon: MapPinned },
  { href: "/admin/guide-funnel", labelKey: "guideFunnel", icon: Filter },
  { href: "/admin/verification", labelKey: "adminVerification", icon: BadgeCheck },
  { href: "/admin/transport", labelKey: "adminTransport", icon: BusFront },
  { href: "/admin/exchange", labelKey: "adminExchange", icon: Banknote },
  { href: "/admin/venues", labelKey: "adminVenues", icon: UtensilsCrossed },
  { href: "/admin/moderation", labelKey: "moderation", icon: Shield },
  { href: "/admin/bookings", labelKey: "adminBookings", icon: Ticket },
  { href: "/admin/taxonomy", labelKey: "taxonomy", icon: Tags },
  { href: "/admin/cases", labelKey: "supportCases", icon: LifeBuoy },
  { href: "/admin/quality", labelKey: "dataQuality", icon: ClipboardCheck },
  { href: "/admin/notifications", labelKey: "notificationHealth", icon: Bell },
  { href: "/admin/audit", labelKey: "auditLog", icon: ScrollText },
  { href: "/admin/settings", labelKey: "settings", icon: Settings },
  { href: "/admin/collections", labelKey: "collections", icon: Sparkles },
  { href: "/admin/planner", labelKey: "plannerHealth", icon: Bot, exact: true },
  { href: "/admin/planner/language", labelKey: "plannerLanguage", icon: Languages },
  { href: "/admin/catalogue", labelKey: "catalogueGrowth", icon: Sprout },
];

// Verified drivers and money changers each get their own portal (V1-V4).
export const DRIVER_NAV: ShellNavItem[] = [
  { href: "/drive", labelKey: "driverHome", icon: Car, exact: true },
  { href: "/drive/requests", labelKey: "driverRequests", icon: Inbox },
  { href: "/drive/rides", labelKey: "driverRides", icon: Route },
];

export const CHANGER_NAV: ShellNavItem[] = [
  { href: "/exchange", labelKey: "changerHome", icon: Banknote, exact: true },
  { href: "/exchange/rates", labelKey: "changerRates", icon: ArrowLeftRight },
];

export const NAV_BY_SURFACE: Record<ShellSurface, ShellNavItem[]> = {
  traveller: TRAVELLER_NAV,
  guide: GUIDE_NAV,
  admin: ADMIN_NAV,
  partner: DRIVER_NAV,
};

export function isNavActive(pathname: string, item: ShellNavItem) {
  const current = pathname.replace(/^\/(en|ar|fr)(?=\/|$)/, "") || "/";
  if (item.exact) {
    return current === item.href;
  }
  return current === item.href || current.startsWith(`${item.href}/`);
}
