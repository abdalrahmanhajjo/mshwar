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
  | "noInjections"
  | "reconciliationQueue"
  | "activeRanker"
  | "plans24h"
  | "degraded24h"
  | "injections24h"
  | "tripIdLabel"
  | "tripIdPlaceholder"
  | "sealed"
  | "consoleKicker"
  | "overviewBody"
  | "openCases"
  | "openIssues"
  | "fromLabel"
  | "toLabel"
  | "usersTitle"
  | "usersBody"
  | "nameCol"
  | "statusCol"
  | "actionsCol"
  | "languageCol"
  | "reasonLabel"
  | "typeLabel"
  | "selectedCount"
  | "openCase"
  | "resolve"
  | "outcomeLabel"
  | "caseReasonLabel"
  | "bookingsList"
  | "selectBooking"
  | "snapshots"
  | "queueEmpty"
  | "collectionsTitle"
  | "collectionsBody"
  | "settingsTitle"
  | "settingsBody"
  | "retiredNote"
  | "rolesNote"
  | "feesNote"
  | "saveFees"
  | "saveFlag"
  | "enabledLabel"
  | "disabledLabel"
  | "retiredLabel"
  | "activeLabel"
  | "verifiedBadge"
  | "notVerified"
  | "kindLabel"
  | "slugLabel"
  | "labelLabel"
  | "mergeTarget"
  | "userIdLabel"
  | "tierLabel"
  | "commissionLabel"
  | "serviceFeeLabel"
  | "flagKeyLabel"
  | "environmentLabel"
  | "cohortLabel"
  | "configVersions"
  | "titleLabel"
  | "descriptionLabel"
  | "stopsLabel"
  | "publishCollection"
  | "savedMessage"
  | "saveFailed"
  | "unknownIp"
  | "runs"
  | "auditTitle"
  | "auditBody"
  | "auditActionFilter"
  | "auditActorFilter"
  | "auditTargetTypeFilter"
  | "auditTargetFilter"
  | "auditRequestFilter"
  | "auditFrom"
  | "auditTo"
  | "auditSearch"
  | "auditReset"
  | "auditLoadMore"
  | "auditEmpty"
  | "auditWhen"
  | "auditActor"
  | "auditAction"
  | "auditTarget"
  | "auditReason"
  | "auditChanges"
  | "auditSystem"
  | "auditAnyOption"
  | "auditFailed"
  | "auditFieldsChanged";

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
    reconciliationQueue: "Reconciliation queue",
    activeRanker: "Active ranker: {value}",
    plans24h: "Plans (24h): {count}",
    degraded24h: "Degraded (24h): {count}",
    injections24h: "Injection events (24h): {count}",
    tripIdLabel: "Trip ID",
    tripIdPlaceholder: "uuid",
    sealed: "sealed",
    consoleKicker: "Operations console",
    overviewBody: "Signals across travellers, businesses, bookings and the planner.",
    openCases: "Open cases",
    openIssues: "Open quality issues",
    fromLabel: "From",
    toLabel: "To",
    usersTitle: "Users",
    usersBody: "Accounts, language and verification state. Unverified accounts can browse but cannot book.",
    nameCol: "Name",
    statusCol: "Status",
    actionsCol: "Actions",
    languageCol: "Language",
    reasonLabel: "Reason for the audit log",
    typeLabel: "Content type",
    selectedCount: "{count} selected",
    openCase: "Open case",
    resolve: "Resolve",
    outcomeLabel: "Outcome note",
    caseReasonLabel: "What is the case about?",
    bookingsList: "Recent bookings",
    selectBooking: "Select a booking to inspect its timeline and payments.",
    snapshots: "Price and policy snapshots",
    queueEmpty: "Nothing in this queue.",
    collectionsTitle: "Collections",
    collectionsBody: "Assemble collections from existing published experiences.",
    settingsTitle: "Settings",
    settingsBody: "Fees, feature flags and weather thresholds.",
    retiredNote: "Retiring keeps history and blocks new assignments.",
    rolesNote: "Admin is a distinct role. It cannot be self-granted.",
    feesNote: "Live-safe keys: marketplace fees and feature flags. Actor, timestamp and previous value are versioned.",
    saveFees: "Save fees",
    saveFlag: "Save flag",
    enabledLabel: "Enabled",
    disabledLabel: "Disabled",
    retiredLabel: "Retired",
    activeLabel: "Active",
    verifiedBadge: "Verified badge",
    notVerified: "Not verified",
    kindLabel: "Kind",
    slugLabel: "Slug",
    labelLabel: "Label",
    mergeTarget: "Merge into (term id)",
    userIdLabel: "User ID",
    tierLabel: "Tier",
    commissionLabel: "Commission (bps)",
    serviceFeeLabel: "Service fee (minor units)",
    flagKeyLabel: "Flag key",
    environmentLabel: "Environment",
    cohortLabel: "Cohort",
    configVersions: "Config versions",
    titleLabel: "Title",
    descriptionLabel: "Description",
    stopsLabel: "Experience slugs (comma separated)",
    publishCollection: "Publish collection",
    savedMessage: "Saved.",
    saveFailed: "Could not save. Sign in and use existing experience slugs.",
    unknownIp: "unknown",
    runs: "Scheduler",
    auditTitle: "Audit log",
    auditBody:
      "Every consequential action: who did it, what changed, when and why. Entries cannot be edited or deleted.",
    auditActionFilter: "Action starts with",
    auditActorFilter: "Actor ID",
    auditTargetTypeFilter: "Record type",
    auditTargetFilter: "Record ID",
    auditRequestFilter: "Request ID",
    auditFrom: "From",
    auditTo: "To",
    auditSearch: "Search",
    auditReset: "Clear filters",
    auditLoadMore: "Load older entries",
    auditEmpty: "No audit entries match these filters.",
    auditWhen: "When",
    auditActor: "Actor",
    auditAction: "Action",
    auditTarget: "Record",
    auditReason: "Reason",
    auditChanges: "Changes",
    auditSystem: "System",
    auditAnyOption: "Any",
    auditFailed: "Could not load the audit log.",
    auditFieldsChanged: "Fields changed",
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
    reconciliationQueue: "طابور التسوية",
    activeRanker: "المرتِّب النشط: {value}",
    plans24h: "الخطط (24س): {count}",
    degraded24h: "متدهورة (24س): {count}",
    injections24h: "أحداث الحقن (24س): {count}",
    tripIdLabel: "معرّف الرحلة",
    tripIdPlaceholder: "uuid",
    sealed: "مُغلقة",
    consoleKicker: "وحدة العمليات",
    overviewBody: "مؤشرات عبر المسافرين والأعمال والحجوزات والمخطِّط.",
    openCases: "حالات مفتوحة",
    openIssues: "مشكلات جودة مفتوحة",
    fromLabel: "من",
    toLabel: "إلى",
    usersTitle: "المستخدمون",
    usersBody: "الحسابات واللغة وحالة التحقق. الحسابات غير الموثّقة تتصفح ولا تحجز.",
    nameCol: "الاسم",
    statusCol: "الحالة",
    actionsCol: "الإجراءات",
    languageCol: "اللغة",
    reasonLabel: "السبب لسجل التدقيق",
    typeLabel: "نوع المحتوى",
    selectedCount: "{count} محدد",
    openCase: "فتح حالة",
    resolve: "حل",
    outcomeLabel: "ملاحظة النتيجة",
    caseReasonLabel: "ما موضوع الحالة؟",
    bookingsList: "أحدث الحجوزات",
    selectBooking: "اختر حجزاً لفحص سجلّه ومدفوعاته.",
    snapshots: "لقطات السعر والسياسة",
    queueEmpty: "لا شيء في هذه القائمة.",
    collectionsTitle: "المجموعات",
    collectionsBody: "اجمع المجموعات من تجارب منشورة.",
    settingsTitle: "الإعدادات",
    settingsBody: "الرسوم ومفاتيح الميزات وحدود الطقس.",
    retiredNote: "الإيقاف يحفظ السجل ويمنع الإسناد الجديد.",
    rolesNote: "المسؤول دور مستقل ولا يمكن منحه للنفس.",
    feesNote: "مفاتيح آمنة: رسوم السوق ومفاتيح الميزات. يُحفظ المنفّذ والوقت والقيمة السابقة.",
    saveFees: "حفظ الرسوم",
    saveFlag: "حفظ المفتاح",
    enabledLabel: "مفعّل",
    disabledLabel: "معطّل",
    retiredLabel: "موقوف",
    activeLabel: "نشط",
    verifiedBadge: "شارة التوثيق",
    notVerified: "غير موثّق",
    kindLabel: "النوع",
    slugLabel: "المعرّف",
    labelLabel: "التسمية",
    mergeTarget: "دمج مع (معرّف المصطلح)",
    userIdLabel: "معرّف المستخدم",
    tierLabel: "المستوى",
    commissionLabel: "العمولة (نقاط أساس)",
    serviceFeeLabel: "رسوم الخدمة (بالوحدات الصغرى)",
    flagKeyLabel: "مفتاح الميزة",
    environmentLabel: "البيئة",
    cohortLabel: "الفئة",
    configVersions: "إصدارات الإعداد",
    titleLabel: "العنوان",
    descriptionLabel: "الوصف",
    stopsLabel: "معرّفات التجارب (مفصولة بفواصل)",
    publishCollection: "نشر المجموعة",
    savedMessage: "تم الحفظ.",
    saveFailed: "تعذّر الحفظ. سجّل الدخول واستخدم معرّفات تجارب موجودة.",
    unknownIp: "غير معروف",
    runs: "المجدول",
    auditTitle: "سجل التدقيق",
    auditBody: "كل إجراء مؤثر: من قام به، وما الذي تغيّر، ومتى، ولماذا. لا يمكن تعديل الإدخالات أو حذفها.",
    auditActionFilter: "يبدأ الإجراء بـ",
    auditActorFilter: "معرّف المنفّذ",
    auditTargetTypeFilter: "نوع السجل",
    auditTargetFilter: "معرّف السجل",
    auditRequestFilter: "معرّف الطلب",
    auditFrom: "من",
    auditTo: "إلى",
    auditSearch: "بحث",
    auditReset: "مسح عوامل التصفية",
    auditLoadMore: "تحميل إدخالات أقدم",
    auditEmpty: "لا توجد إدخالات تدقيق مطابقة لهذه المعايير.",
    auditWhen: "الوقت",
    auditActor: "المنفّذ",
    auditAction: "الإجراء",
    auditTarget: "السجل",
    auditReason: "السبب",
    auditChanges: "التغييرات",
    auditSystem: "النظام",
    auditAnyOption: "الكل",
    auditFailed: "تعذّر تحميل سجل التدقيق.",
    auditFieldsChanged: "الحقول المعدّلة",
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
    reconciliationQueue: "File de réconciliation",
    activeRanker: "Ranker actif : {value}",
    plans24h: "Plans (24 h) : {count}",
    degraded24h: "Dégradés (24 h) : {count}",
    injections24h: "Injections (24 h) : {count}",
    tripIdLabel: "ID du voyage",
    tripIdPlaceholder: "uuid",
    sealed: "scellé",
    consoleKicker: "Console des opérations",
    overviewBody: "Signaux sur les voyageurs, les entreprises, les réservations et le planificateur.",
    openCases: "Dossiers ouverts",
    openIssues: "Problèmes de qualité ouverts",
    fromLabel: "Du",
    toLabel: "Au",
    usersTitle: "Utilisateurs",
    usersBody: "Comptes, langue et vérification. Les comptes non vérifiés peuvent naviguer mais pas réserver.",
    nameCol: "Nom",
    statusCol: "Statut",
    actionsCol: "Actions",
    languageCol: "Langue",
    reasonLabel: "Motif pour le journal d’audit",
    typeLabel: "Type de contenu",
    selectedCount: "{count} sélectionné(s)",
    openCase: "Ouvrir un dossier",
    resolve: "Résoudre",
    outcomeLabel: "Note de résolution",
    caseReasonLabel: "Quel est l’objet du dossier ?",
    bookingsList: "Réservations récentes",
    selectBooking: "Sélectionnez une réservation pour voir son historique et ses paiements.",
    snapshots: "Instantanés prix et politique",
    queueEmpty: "Rien dans cette file.",
    collectionsTitle: "Collections",
    collectionsBody: "Composez des collections à partir d’expériences publiées.",
    settingsTitle: "Paramètres",
    settingsBody: "Frais, fonctionnalités et seuils météo.",
    retiredNote: "Le retrait conserve l’historique et bloque les nouvelles affectations.",
    rolesNote: "Administrateur est un rôle distinct. Il ne peut pas être auto-attribué.",
    feesNote: "Clés modifiables à chaud : frais et fonctionnalités. Auteur, date et valeur précédente sont versionnés.",
    saveFees: "Enregistrer les frais",
    saveFlag: "Enregistrer",
    enabledLabel: "Activé",
    disabledLabel: "Désactivé",
    retiredLabel: "Retiré",
    activeLabel: "Actif",
    verifiedBadge: "Badge vérifié",
    notVerified: "Non vérifié",
    kindLabel: "Type",
    slugLabel: "Identifiant",
    labelLabel: "Libellé",
    mergeTarget: "Fusionner avec (id du terme)",
    userIdLabel: "ID utilisateur",
    tierLabel: "Niveau",
    commissionLabel: "Commission (pb)",
    serviceFeeLabel: "Frais de service (centimes)",
    flagKeyLabel: "Clé",
    environmentLabel: "Environnement",
    cohortLabel: "Cohorte",
    configVersions: "Versions de configuration",
    titleLabel: "Titre",
    descriptionLabel: "Description",
    stopsLabel: "Identifiants d’expériences (séparés par des virgules)",
    publishCollection: "Publier la collection",
    savedMessage: "Enregistré.",
    saveFailed: "Échec de l’enregistrement. Connectez-vous et utilisez des identifiants existants.",
    unknownIp: "inconnue",
    runs: "Planificateur",
    auditTitle: "Journal d’audit",
    auditBody:
      "Chaque action importante : qui l’a faite, ce qui a changé, quand et pourquoi. Les entrées ne peuvent être ni modifiées ni supprimées.",
    auditActionFilter: "L’action commence par",
    auditActorFilter: "ID de l’auteur",
    auditTargetTypeFilter: "Type d’enregistrement",
    auditTargetFilter: "ID de l’enregistrement",
    auditRequestFilter: "ID de requête",
    auditFrom: "Du",
    auditTo: "Au",
    auditSearch: "Rechercher",
    auditReset: "Effacer les filtres",
    auditLoadMore: "Charger des entrées plus anciennes",
    auditEmpty: "Aucune entrée ne correspond à ces filtres.",
    auditWhen: "Date",
    auditActor: "Auteur",
    auditAction: "Action",
    auditTarget: "Enregistrement",
    auditReason: "Motif",
    auditChanges: "Modifications",
    auditSystem: "Système",
    auditAnyOption: "Tous",
    auditFailed: "Impossible de charger le journal d’audit.",
    auditFieldsChanged: "Champs modifiés",
  },
};

export function useAdminCopy() {
  const { locale } = useLocale();
  return adminCopy[locale];
}
