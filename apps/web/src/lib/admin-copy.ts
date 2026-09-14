import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type AdminKey =
  | "queueTitle"
  | "slaHours"
  | "filterStatus"
  | "documents"
  | "approve"
  | "reject"
  | "suspend"
  | "reVerify"
  | "reasonRequired"
  | "moderationTitle"
  | "hide"
  | "restore"
  | "escalate"
  | "bulk"
  | "confirmBulk"
  | "originalPreserved"
  | "taxonomyTitle"
  | "createTerm"
  | "rename"
  | "merge"
  | "retire"
  | "bookingInspector"
  | "timeline"
  | "payments"
  | "forceCancel"
  | "markRefunded"
  | "resendConfirmation"
  | "elevatedOnly"
  | "fees"
  | "flags"
  | "rollback"
  | "kpiTitle"
  | "metricDefinition"
  | "casesTitle"
  | "assign"
  | "outcomeRequired"
  | "qualityTitle"
  | "runChecks"
  | "notifyBusiness"
  | "rolesTitle"
  | "grantRole"
  | "revokeRole"
  | "sessionLog"
  | "notAdmin"
  | "plannerHealthTitle"
  | "plannerHealthHint"
  | "plannerInjections"
  | "plannerInjectionsHint"
  | "plannerVersions"
  | "lookupVersions"
  | "noInjections";

export const adminCopy: Record<Locale, Record<AdminKey, string>> = {
  en: {
    queueTitle: "Verification queue",
    slaHours: "SLA age (hours)",
    filterStatus: "Filter by status",
    documents: "Documents",
    approve: "Approve",
    reject: "Reject",
    suspend: "Suspend",
    reVerify: "Re-verify",
    reasonRequired: "A reason is required and is written to the audit log.",
    moderationTitle: "Content moderation",
    hide: "Hide",
    restore: "Restore",
    escalate: "Escalate",
    bulk: "Bulk action",
    confirmBulk: "Confirm bulk moderation",
    originalPreserved: "Original content is kept. Review text is never rewritten.",
    taxonomyTitle: "Taxonomy",
    createTerm: "Create term",
    rename: "Rename",
    merge: "Merge",
    retire: "Retire",
    bookingInspector: "Booking inspector",
    timeline: "Timeline",
    payments: "Payments",
    forceCancel: "Force cancel",
    markRefunded: "Mark refunded",
    resendConfirmation: "Resend confirmation",
    elevatedOnly: "Financial actions need an elevated admin.",
    fees: "Fees and commission",
    flags: "Feature flags",
    rollback: "Roll back",
    kpiTitle: "Platform health",
    metricDefinition: "Definition",
    casesTitle: "Support cases",
    assign: "Assign",
    outcomeRequired: "Resolution needs an outcome note.",
    qualityTitle: "Data quality",
    runChecks: "Run checks",
    notifyBusiness: "Notify business",
    rolesTitle: "Admin roles",
    grantRole: "Grant role",
    revokeRole: "Revoke",
    sessionLog: "Session log",
    notAdmin: "This console is only for platform operators.",
    plannerHealthTitle: "Planner health",
    plannerHealthHint: "Circuit-breaker and injection signals for support. Ranker weights are versioned.",
    plannerInjections: "Injection attempts",
    plannerInjectionsHint: "User and business text is treated as data. The model cannot book, pay or change a price.",
    plannerVersions: "Itinerary versions",
    lookupVersions: "Look up versions",
    noInjections: "No injection attempts logged.",
  },
  ar: {
    queueTitle: "طابور التحقق",
    slaHours: "عمر اتفاقية الخدمة (ساعات)",
    filterStatus: "تصفية حسب الحالة",
    documents: "المستندات",
    approve: "موافقة",
    reject: "رفض",
    suspend: "تعليق",
    reVerify: "إعادة تحقق",
    reasonRequired: "السبب مطلوب ويُسجَّل في سجل التدقيق.",
    moderationTitle: "الإشراف على المحتوى",
    hide: "إخفاء",
    restore: "استعادة",
    escalate: "تصعيد",
    bulk: "إجراء جماعي",
    confirmBulk: "تأكيد الإشراف الجماعي",
    originalPreserved: "يُحفظ الأصل. لا يُعاد كتابة نص المراجعة.",
    taxonomyTitle: "التصنيف",
    createTerm: "إنشاء مصطلح",
    rename: "إعادة تسمية",
    merge: "دمج",
    retire: "إيقاف",
    bookingInspector: "فحص الحجز",
    timeline: "الجدول الزمني",
    payments: "المدفوعات",
    forceCancel: "إلغاء قسري",
    markRefunded: "وسم كمسترد",
    resendConfirmation: "إعادة إرسال التأكيد",
    elevatedOnly: "الإجراءات المالية تحتاج مشغّلاً مرتفع الصلاحية.",
    fees: "الرسوم والعمولة",
    flags: "ميزات تجريبية",
    rollback: "تراجع",
    kpiTitle: "صحة المنصة",
    metricDefinition: "التعريف",
    casesTitle: "حالات الدعم",
    assign: "تعيين",
    outcomeRequired: "الإغلاق يحتاج ملاحظة نتيجة.",
    qualityTitle: "جودة البيانات",
    runChecks: "تشغيل الفحوصات",
    notifyBusiness: "إشعار النشاط",
    rolesTitle: "أدوار الإدارة",
    grantRole: "منح الدور",
    revokeRole: "سحب",
    sessionLog: "سجل الجلسات",
    notAdmin: "هذه الوحدة للمشغّلين فقط.",
    plannerHealthTitle: "صحة المخطِّط",
    plannerHealthHint: "إشارات القاطع ومحاولات الحقن للدعم. أوزان الترتيب مُصدَّرة بإصدار.",
    plannerInjections: "محاولات الحقن",
    plannerInjectionsHint: "نص المستخدم والنشاط بيانات فقط. لا يحجز النموذج ولا يدفع ولا يغيّر سعراً.",
    plannerVersions: "إصدارات البرنامج",
    lookupVersions: "عرض الإصدارات",
    noInjections: "لا محاولات حقن مسجّلة.",
  },
  fr: {
    queueTitle: "File de vérification",
    slaHours: "Âge SLA (heures)",
    filterStatus: "Filtrer par statut",
    documents: "Documents",
    approve: "Approuver",
    reject: "Rejeter",
    suspend: "Suspendre",
    reVerify: "Revérifier",
    reasonRequired: "Un motif est obligatoire et journalisé.",
    moderationTitle: "Modération",
    hide: "Masquer",
    restore: "Restaurer",
    escalate: "Escalader",
    bulk: "Action groupée",
    confirmBulk: "Confirmer la modération groupée",
    originalPreserved: "Le contenu original est conservé. Le texte d’avis n’est jamais réécrit.",
    taxonomyTitle: "Taxonomie",
    createTerm: "Créer un terme",
    rename: "Renommer",
    merge: "Fusionner",
    retire: "Retirer",
    bookingInspector: "Inspecteur de réservation",
    timeline: "Chronologie",
    payments: "Paiements",
    forceCancel: "Annulation forcée",
    markRefunded: "Marquer remboursé",
    resendConfirmation: "Renvoyer la confirmation",
    elevatedOnly: "Les actions financières exigent un admin élevé.",
    fees: "Frais et commission",
    flags: "Indicateurs de fonction",
    rollback: "Revenir",
    kpiTitle: "Santé de la plateforme",
    metricDefinition: "Définition",
    casesTitle: "Tickets support",
    assign: "Assigner",
    outcomeRequired: "La résolution exige une note de résultat.",
    qualityTitle: "Qualité des données",
    runChecks: "Lancer les contrôles",
    notifyBusiness: "Notifier l’entreprise",
    rolesTitle: "Rôles admin",
    grantRole: "Accorder le rôle",
    revokeRole: "Révoquer",
    sessionLog: "Journal de session",
    notAdmin: "Cette console est réservée aux opérateurs.",
    plannerHealthTitle: "Santé du planificateur",
    plannerHealthHint: "Signaux de disjoncteur et d’injection pour le support. Pondérations versionnées.",
    plannerInjections: "Tentatives d’injection",
    plannerInjectionsHint:
      "Le texte utilisateur ou métier est une donnée. Le modèle ne réserve, ne paie ni ne change un prix.",
    plannerVersions: "Versions d’itinéraire",
    lookupVersions: "Consulter les versions",
    noInjections: "Aucune tentative d’injection.",
  },
};

export function useAdminCopy() {
  const { locale } = useLocale();
  return adminCopy[locale];
}
