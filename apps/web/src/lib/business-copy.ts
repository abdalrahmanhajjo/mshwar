import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type BusinessKey =
  | "registerTitle"
  | "registerHint"
  | "orgName"
  | "createOrg"
  | "onboarding"
  | "checklist"
  | "itemOrg"
  | "itemContact"
  | "itemDocs"
  | "itemSubmission"
  | "itemListing"
  | "itemVerified"
  | "pendingBanner"
  | "cannotPublish"
  | "verifiedBadge"
  | "submitVerification"
  | "legalName"
  | "registrationNumber"
  | "supportingDocs"
  | "uploadDoc"
  | "listingsHint"
  | "newListing"
  | "draft"
  | "published"
  | "paused"
  | "pause"
  | "unpause"
  | "publish"
  | "publishReport"
  | "readyToPublish"
  | "blockedPublish"
  | "editorCategory"
  | "editorImages"
  | "editorLocation"
  | "editorDuration"
  | "editorPricing"
  | "editorPolicies"
  | "mapHint"
  | "outsideLebanon"
  | "insideLebanon"
  | "weatherSensitivity"
  | "groupSuitability"
  | "saveListing"
  | "hoursTitle"
  | "datedException"
  | "generateSlots"
  | "blackout"
  | "capacity"
  | "remaining"
  | "inboxTitle"
  | "confirm"
  | "reject"
  | "reason"
  | "optionalMessage"
  | "calendarDay"
  | "calendarWeek"
  | "exportCsv"
  | "filters"
  | "teamHint"
  | "inviteStaff"
  | "revoke"
  | "roleListings"
  | "roleBookings"
  | "roleFinance"
  | "roleSettings"
  | "publicContact"
  | "internalContact"
  | "fulfilment"
  | "internalNeverPublic"
  | "metricsTitle"
  | "views"
  | "saves"
  | "inclusions"
  | "requests"
  | "confirmations"
  | "revenue"
  | "comparison"
  | "noOrgs"
  | "emptyListings"
  | "emptyInbox"
  | "adminVerify"
  | "adminReject"
  | "bookingMode"
  | "modeInstant"
  | "modeRequest"
  | "modeInquiry"
  | "instantRequiresCapacity";

export const businessCopy: Record<Locale, Record<BusinessKey, string>> = {
  en: {
    registerTitle: "Register your organisation",
    registerHint: "You land in pending verification. Drafts are fine; publishing waits for an admin.",
    orgName: "Organisation name",
    createOrg: "Create organisation",
    onboarding: "Onboarding",
    checklist: "Still required",
    itemOrg: "Organisation profile",
    itemContact: "Public contact details",
    itemDocs: "Supporting documents",
    itemSubmission: "Verification submitted",
    itemListing: "First listing draft",
    itemVerified: "Admin verification",
    pendingBanner: "Pending verification — travellers will not see published listings yet.",
    cannotPublish: "Cannot publish while the organisation is pending verification.",
    verifiedBadge: "Verified",
    submitVerification: "Submit for review",
    legalName: "Legal name",
    registrationNumber: "Registration number",
    supportingDocs: "Supporting documents (stored privately)",
    uploadDoc: "Upload document",
    listingsHint: "Inventory the traveller app can book after admin verification.",
    newListing: "New listing",
    draft: "Draft",
    published: "Published",
    paused: "Paused",
    pause: "Pause",
    unpause: "Unpause",
    publish: "Publish",
    publishReport: "Pre-publish checks",
    readyToPublish: "Ready to publish",
    blockedPublish: "Fix the report before publishing.",
    editorCategory: "Category",
    editorImages: "Images",
    editorLocation: "Location",
    editorDuration: "Duration",
    editorPricing: "Pricing",
    editorPolicies: "Policies",
    mapHint: "Drop a pin or enter coordinates. They must fall inside Lebanon.",
    outsideLebanon: "These coordinates are outside Lebanon.",
    insideLebanon: "Inside Lebanon bounding box.",
    weatherSensitivity: "Weather sensitivity",
    groupSuitability: "Group suitability",
    saveListing: "Save listing",
    hoursTitle: "Hours, slots and blackouts",
    datedException: "Close a specific date",
    generateSlots: "Generate slots",
    blackout: "Blackout",
    capacity: "Capacity",
    remaining: "Remaining",
    inboxTitle: "Booking inbox",
    confirm: "Confirm",
    reject: "Reject",
    reason: "Reason",
    optionalMessage: "Optional message",
    calendarDay: "Day",
    calendarWeek: "Week",
    exportCsv: "Export CSV",
    filters: "Filters",
    teamHint: "Invite staff by email. Roles gate listings, bookings, finance and settings separately.",
    inviteStaff: "Send invite",
    revoke: "Revoke",
    roleListings: "Listings",
    roleBookings: "Bookings",
    roleFinance: "Finance",
    roleSettings: "Settings",
    publicContact: "Public contact",
    internalContact: "Internal fulfilment contact",
    fulfilment: "Fulfilment instructions",
    internalNeverPublic: "Internal contacts never appear on public pages.",
    metricsTitle: "Performance",
    views: "Views",
    saves: "Saves",
    inclusions: "Itinerary inclusions",
    requests: "Requests",
    confirmations: "Confirmations",
    revenue: "Revenue",
    comparison: "Compared with the previous period of the same length.",
    noOrgs: "Create an organisation to open the portal.",
    emptyListings: "No listings yet. Draft one while verification is pending.",
    emptyInbox: "No booking requests in this filter.",
    adminVerify: "Verify",
    adminReject: "Reject",
    bookingMode: "Booking mode",
    modeInstant: "Instant confirm",
    modeRequest: "Request to book",
    modeInquiry: "Inquiry only",
    instantRequiresCapacity: "Instant confirm is only honoured when capacity is authoritative.",
  },
  ar: {
    registerTitle: "سجّل مؤسستك",
    registerHint: "تبدأ بحالة انتظار التحقق. المسودات مسموحة؛ النشر ينتظر المشرف.",
    orgName: "اسم المؤسسة",
    createOrg: "إنشاء المؤسسة",
    onboarding: "التأهيل",
    checklist: "ما زال مطلوباً",
    itemOrg: "ملف المؤسسة",
    itemContact: "بيانات التواصل العامة",
    itemDocs: "مستندات داعمة",
    itemSubmission: "إرسال طلب التحقق",
    itemListing: "مسودة العرض الأولى",
    itemVerified: "تحقق المشرف",
    pendingBanner: "بانتظار التحقق — لن يرى المسافرون العروض بعد.",
    cannotPublish: "لا يمكن النشر بينما المؤسسة بانتظار التحقق.",
    verifiedBadge: "موثّق",
    submitVerification: "إرسال للمراجعة",
    legalName: "الاسم القانوني",
    registrationNumber: "رقم التسجيل",
    supportingDocs: "مستندات داعمة (تخزين خاص)",
    uploadDoc: "رفع مستند",
    listingsHint: "المخزون الذي يمكن لتطبيق المسافر حجزه بعد التحقق.",
    newListing: "عرض جديد",
    draft: "مسودة",
    published: "منشور",
    paused: "متوقف",
    pause: "إيقاف",
    unpause: "إعادة التشغيل",
    publish: "نشر",
    publishReport: "فحوصات ما قبل النشر",
    readyToPublish: "جاهز للنشر",
    blockedPublish: "أصلح التقرير قبل النشر.",
    editorCategory: "الفئة",
    editorImages: "الصور",
    editorLocation: "الموقع",
    editorDuration: "المدة",
    editorPricing: "التسعير",
    editorPolicies: "السياسات",
    mapHint: "ضع إشارة أو أدخل الإحداثيات. يجب أن تقع داخل لبنان.",
    outsideLebanon: "هذه الإحداثيات خارج لبنان.",
    insideLebanon: "داخل حدود لبنان.",
    weatherSensitivity: "حساسية الطقس",
    groupSuitability: "ملاءمة المجموعة",
    saveListing: "حفظ العرض",
    hoursTitle: "الساعات والفترات والإغلاقات",
    datedException: "إغلاق تاريخ محدد",
    generateSlots: "توليد الفترات",
    blackout: "إغلاق",
    capacity: "السعة",
    remaining: "المتبقي",
    inboxTitle: "صندوق الحجوزات",
    confirm: "تأكيد",
    reject: "رفض",
    reason: "السبب",
    optionalMessage: "رسالة اختيارية",
    calendarDay: "يوم",
    calendarWeek: "أسبوع",
    exportCsv: "تصدير CSV",
    filters: "عوامل التصفية",
    teamHint: "ادعُ الموظفين بالبريد. الأدوار تفصل العروض والحجوزات والمالية والإعدادات.",
    inviteStaff: "إرسال الدعوة",
    revoke: "إلغاء",
    roleListings: "العروض",
    roleBookings: "الحجوزات",
    roleFinance: "المالية",
    roleSettings: "الإعدادات",
    publicContact: "تواصل عام",
    internalContact: "تواصل داخلي للتنفيذ",
    fulfilment: "تعليمات التنفيذ",
    internalNeverPublic: "بيانات التواصل الداخلية لا تظهر في الصفحات العامة.",
    metricsTitle: "الأداء",
    views: "المشاهدات",
    saves: "الحفظ",
    inclusions: "إدراج في الرحلات",
    requests: "الطلبات",
    confirmations: "التأكيدات",
    revenue: "الإيراد",
    comparison: "مقارنة مع الفترة السابقة بنفس الطول.",
    noOrgs: "أنشئ مؤسسة لفتح البوابة.",
    emptyListings: "لا عروض بعد. اكتب مسودة أثناء انتظار التحقق.",
    emptyInbox: "لا طلبات في هذا التصفية.",
    adminVerify: "توثيق",
    adminReject: "رفض",
    bookingMode: "طريقة الحجز",
    modeInstant: "تأكيد فوري",
    modeRequest: "طلب حجز",
    modeInquiry: "استفسار فقط",
    instantRequiresCapacity: "التأكيد الفوري يعمل فقط مع سعة موثوقة.",
  },
  fr: {
    registerTitle: "Enregistrer votre organisation",
    registerHint:
      "Vous arrivez en vérification en attente. Les brouillons sont possibles ; la publication attend un admin.",
    orgName: "Nom de l’organisation",
    createOrg: "Créer l’organisation",
    onboarding: "Intégration",
    checklist: "Encore requis",
    itemOrg: "Profil de l’organisation",
    itemContact: "Contact public",
    itemDocs: "Documents justificatifs",
    itemSubmission: "Dossier soumis",
    itemListing: "Premier brouillon",
    itemVerified: "Vérification admin",
    pendingBanner: "Vérification en attente — les voyageurs ne verront pas encore les annonces.",
    cannotPublish: "Publication impossible tant que l’organisation est en attente.",
    verifiedBadge: "Vérifié",
    submitVerification: "Soumettre pour examen",
    legalName: "Raison sociale",
    registrationNumber: "Numéro d’enregistrement",
    supportingDocs: "Documents justificatifs (stockage privé)",
    uploadDoc: "Téléverser un document",
    listingsHint: "Inventaire réservable après vérification admin.",
    newListing: "Nouvelle annonce",
    draft: "Brouillon",
    published: "Publié",
    paused: "En pause",
    pause: "Mettre en pause",
    unpause: "Réactiver",
    publish: "Publier",
    publishReport: "Contrôles avant publication",
    readyToPublish: "Prêt à publier",
    blockedPublish: "Corrigez le rapport avant de publier.",
    editorCategory: "Catégorie",
    editorImages: "Images",
    editorLocation: "Lieu",
    editorDuration: "Durée",
    editorPricing: "Tarifs",
    editorPolicies: "Politiques",
    mapHint: "Placez un point ou saisissez des coordonnées. Elles doivent être au Liban.",
    outsideLebanon: "Ces coordonnées sont hors du Liban.",
    insideLebanon: "Dans l’emprise du Liban.",
    weatherSensitivity: "Sensibilité météo",
    groupSuitability: "Public adapté",
    saveListing: "Enregistrer l’annonce",
    hoursTitle: "Horaires, créneaux et fermetures",
    datedException: "Fermer une date précise",
    generateSlots: "Générer les créneaux",
    blackout: "Fermeture",
    capacity: "Capacité",
    remaining: "Restant",
    inboxTitle: "Boîte de réservations",
    confirm: "Confirmer",
    reject: "Refuser",
    reason: "Motif",
    optionalMessage: "Message facultatif",
    calendarDay: "Jour",
    calendarWeek: "Semaine",
    exportCsv: "Exporter CSV",
    filters: "Filtres",
    teamHint: "Invitez le personnel par e-mail. Les rôles séparent annonces, réservations, finance et réglages.",
    inviteStaff: "Envoyer l’invitation",
    revoke: "Révoquer",
    roleListings: "Annonces",
    roleBookings: "Réservations",
    roleFinance: "Finance",
    roleSettings: "Réglages",
    publicContact: "Contact public",
    internalContact: "Contact interne d’exécution",
    fulfilment: "Instructions d’exécution",
    internalNeverPublic: "Les contacts internes n’apparaissent jamais sur les pages publiques.",
    metricsTitle: "Performance",
    views: "Vues",
    saves: "Enregistrements",
    inclusions: "Inclusions d’itinéraire",
    requests: "Demandes",
    confirmations: "Confirmations",
    revenue: "Revenu",
    comparison: "Comparé à la période précédente de même durée.",
    noOrgs: "Créez une organisation pour ouvrir le portail.",
    emptyListings: "Pas encore d’annonces. Rédigez un brouillon pendant la vérification.",
    emptyInbox: "Aucune demande pour ce filtre.",
    adminVerify: "Vérifier",
    adminReject: "Refuser",
    bookingMode: "Mode de réservation",
    modeInstant: "Confirmation immédiate",
    modeRequest: "Demande de réservation",
    modeInquiry: "Renseignement uniquement",
    instantRequiresCapacity: "La confirmation immédiate exige une capacité officielle.",
  },
};

export function useBusinessCopy() {
  const { locale } = useLocale();
  return businessCopy[locale];
}

export const CHECKLIST_LABELS: Record<string, BusinessKey> = {
  org_profile: "itemOrg",
  public_contact: "itemContact",
  verification_docs: "itemDocs",
  verification_submission: "itemSubmission",
  first_listing: "itemListing",
  verified: "itemVerified",
};
