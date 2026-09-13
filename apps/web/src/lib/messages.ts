import type { Locale } from "@/lib/locale";

export type MessageKey =
  | "skipToContent"
  | "openMenu"
  | "closeMenu"
  | "language"
  | "signIn"
  | "signUp"
  | "signOut"
  | "email"
  | "password"
  | "displayName"
  | "createAccount"
  | "haveAccount"
  | "noAccount"
  | "authError"
  | "passwordHint"
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
    signUp: "Sign up",
    signOut: "Sign out",
    email: "Email",
    password: "Password",
    displayName: "Display name",
    createAccount: "Create account",
    haveAccount: "Already have an account?",
    noAccount: "New to Mshwar?",
    authError: "Something went wrong. Try again.",
    passwordHint: "At least 10 characters. Stored as an Argon2id hash — never logged.",
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
    signUp: "إنشاء حساب",
    signOut: "تسجيل الخروج",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    displayName: "الاسم الظاهر",
    createAccount: "إنشاء الحساب",
    haveAccount: "لديك حساب؟",
    noAccount: "جديد على مشوار؟",
    authError: "حدث خطأ. حاول مرة أخرى.",
    passwordHint: "عشرة أحرف على الأقل. تُحفظ كتجزئة Argon2id ولا تُسجَّل كنص.",
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
    signUp: "Créer un compte",
    signOut: "Déconnexion",
    email: "E-mail",
    password: "Mot de passe",
    displayName: "Nom affiché",
    createAccount: "Créer le compte",
    haveAccount: "Vous avez déjà un compte ?",
    noAccount: "Nouveau sur Mshwar ?",
    authError: "Une erreur s’est produite. Réessayez.",
    passwordHint: "Au moins 10 caractères. Stocké en Argon2id — jamais consigné en clair.",
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
