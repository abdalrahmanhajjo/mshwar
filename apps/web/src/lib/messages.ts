import type { Locale } from "@/lib/locale";

export type MessageKey =
  | "skipToContent"
  | "openMenu"
  | "closeMenu"
  | "language"
  | "signIn"
  | "signedInAs"
  | "discover"
  | "plan"
  | "saved"
  | "bookings"
  | "dashboard"
  | "listings"
  | "finance"
  | "team"
  | "overview"
  | "users"
  | "businesses"
  | "moderation"
  | "settings"
  | "privacy"
  | "terms"
  | "contact"
  | "travellerFooter"
  | "businessFooter"
  | "adminFooter"
  | "guest"
  | "menu"
  | "travellerSurface"
  | "businessSurface"
  | "adminSurface";

export const messages: Record<Locale, Record<MessageKey, string>> = {
  en: {
    skipToContent: "Skip to content",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    language: "Language",
    signIn: "Sign in",
    signedInAs: "Signed in as",
    discover: "Discover",
    plan: "Plan",
    saved: "Saved",
    bookings: "Bookings",
    dashboard: "Dashboard",
    listings: "Listings",
    finance: "Finance",
    team: "Team",
    overview: "Overview",
    users: "Users",
    businesses: "Businesses",
    moderation: "Moderation",
    settings: "Settings",
    privacy: "Privacy",
    terms: "Terms",
    contact: "Contact",
    travellerFooter: "Discover. Plan. Book Lebanon.",
    businessFooter: "Business portal — structured inventory only.",
    adminFooter: "Admin console — internal operators.",
    guest: "Guest",
    menu: "Menu",
    travellerSurface: "Traveller",
    businessSurface: "Business",
    adminSurface: "Admin",
  },
  ar: {
    skipToContent: "تخطّ إلى المحتوى",
    openMenu: "فتح القائمة",
    closeMenu: "إغلاق القائمة",
    language: "اللغة",
    signIn: "تسجيل الدخول",
    signedInAs: "مسجّل الدخول باسم",
    discover: "اكتشف",
    plan: "خطّط",
    saved: "المحفوظات",
    bookings: "الحجوزات",
    dashboard: "لوحة التحكم",
    listings: "العروض",
    finance: "المالية",
    team: "الفريق",
    overview: "نظرة عامة",
    users: "المستخدمون",
    businesses: "الشركات",
    moderation: "الإشراف",
    settings: "الإعدادات",
    privacy: "الخصوصية",
    terms: "الشروط",
    contact: "تواصل",
    travellerFooter: "اكتشف. خطّط. احجز لبنان.",
    businessFooter: "بوابة الأعمال — مخزون منظّم فقط.",
    adminFooter: "وحدة الإدارة — للمشغّلين الداخليين.",
    guest: "زائر",
    menu: "القائمة",
    travellerSurface: "المسافر",
    businessSurface: "الأعمال",
    adminSurface: "الإدارة",
  },
  fr: {
    skipToContent: "Aller au contenu",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    language: "Langue",
    signIn: "Connexion",
    signedInAs: "Connecté en tant que",
    discover: "Découvrir",
    plan: "Planifier",
    saved: "Enregistrés",
    bookings: "Réservations",
    dashboard: "Tableau de bord",
    listings: "Annonces",
    finance: "Finance",
    team: "Équipe",
    overview: "Aperçu",
    users: "Utilisateurs",
    businesses: "Entreprises",
    moderation: "Modération",
    settings: "Réglages",
    privacy: "Confidentialité",
    terms: "Conditions",
    contact: "Contact",
    travellerFooter: "Découvrir. Planifier. Réserver le Liban.",
    businessFooter: "Portail professionnel — inventaire structuré uniquement.",
    adminFooter: "Console d’administration — opérateurs internes.",
    guest: "Invité",
    menu: "Menu",
    travellerSurface: "Voyageur",
    businessSurface: "Professionnel",
    adminSurface: "Admin",
  },
};
