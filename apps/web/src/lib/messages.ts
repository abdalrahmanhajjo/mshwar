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
  | "forgotPassword"
  | "resetPassword"
  | "sendResetLink"
  | "resetSent"
  | "forgotHint"
  | "newPassword"
  | "invalidReset"
  | "updatePassword"
  | "backToSignIn"
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
    forgotPassword: "Forgot password?",
    resetPassword: "Reset password",
    sendResetLink: "Send reset link",
    resetSent: "If an account exists for this address, a reset link has been sent.",
    forgotHint: "Enter the email on the account. The next screen is the same whether or not it is registered.",
    newPassword: "New password",
    invalidReset: "This reset link is invalid or has expired.",
    updatePassword: "Update password",
    backToSignIn: "Back to sign in",
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
    forgotPassword: "نسيت كلمة المرور؟",
    resetPassword: "إعادة تعيين كلمة المرور",
    sendResetLink: "إرسال الرابط",
    resetSent: "إذا كان هناك حساب لهذا العنوان، فقد أُرسل رابط إعادة التعيين.",
    forgotHint: "أدخل البريد الإلكتروني للحساب. الرسالة التالية واحدة سواء وُجد الحساب أم لا.",
    newPassword: "كلمة المرور الجديدة",
    invalidReset: "رابط إعادة التعيين غير صالح أو منتهٍ.",
    updatePassword: "تحديث كلمة المرور",
    backToSignIn: "العودة لتسجيل الدخول",
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
    forgotPassword: "Mot de passe oublié ?",
    resetPassword: "Réinitialiser le mot de passe",
    sendResetLink: "Envoyer le lien",
    resetSent: "Si un compte existe pour cette adresse, un lien de réinitialisation a été envoyé.",
    forgotHint: "Saisissez l’e-mail du compte. L’écran suivant est identique que l’adresse soit inscrite ou non.",
    newPassword: "Nouveau mot de passe",
    invalidReset: "Ce lien de réinitialisation est invalide ou a expiré.",
    updatePassword: "Mettre à jour le mot de passe",
    backToSignIn: "Retour à la connexion",
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
