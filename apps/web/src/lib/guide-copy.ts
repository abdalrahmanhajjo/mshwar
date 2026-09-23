import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type GuideKey =
  | "kicker"
  | "applyTitle"
  | "applyBody"
  | "tierLabel"
  | "tierLicensed"
  | "tierLicensedHint"
  | "tierHost"
  | "tierHostHint"
  | "nameLabel"
  | "headlineLabel"
  | "headlinePlaceholder"
  | "bioLabel"
  | "bioPlaceholder"
  | "languagesLabel"
  | "regionsLabel"
  | "specialitiesLabel"
  | "yearsLabel"
  | "phoneLabel"
  | "saveDraft"
  | "saving"
  | "savedNote"
  | "documentsTitle"
  | "documentsBody"
  | "documentRequired"
  | "documentOptional"
  | "documentAdd"
  | "documentReplace"
  | "documentReference"
  | "documentIssuer"
  | "documentExpires"
  | "documentFile"
  | "documentPending"
  | "documentVerified"
  | "documentRejected"
  | "documentExpired"
  | "documentMissing"
  | "submitAction"
  | "submitting"
  | "submitBlocked"
  | "statusDraft"
  | "statusSubmitted"
  | "statusApproved"
  | "statusRejected"
  | "statusSuspended"
  | "statusDraftBody"
  | "statusSubmittedBody"
  | "statusApprovedBody"
  | "statusRejectedBody"
  | "statusSuspendedBody"
  | "viewPublicPage"
  | "badgeLicensed"
  | "badgeHost"
  | "badgeLapsed"
  | "directoryTitle"
  | "directoryBody"
  | "directoryEmpty"
  | "directoryFilterRegion"
  | "directoryFilterLanguage"
  | "directoryAll"
  | "guideLanguages"
  | "guideRegions"
  | "guideSpecialities"
  | "guideYears"
  | "guideNotFound"
  | "queueTitle"
  | "queueBody"
  | "queueEmpty"
  | "queueFilterAll"
  | "queueMissing"
  | "queueDocuments"
  | "queueReview"
  | "reviewVerify"
  | "reviewReject"
  | "reviewApprove"
  | "reviewSuspend"
  | "reviewReason"
  | "reviewReasonPlaceholder"
  | "reviewBlocked"
  | "reviewBack"
  | "loadError"
  | "docLicence"
  | "docId"
  | "docFirstAid"
  | "docInsurance"
  | "docDriving";

export const guideCopy: Record<Locale, Record<GuideKey, string>> = {
  en: {
    kicker: "Guide with Mshwar",
    applyTitle: "Guide with Mshwar",
    applyBody: "Publish the days you already run. Travellers find you, ask for you, and pay you on the day.",
    tierLabel: "How do you guide?",
    tierLicensed: "Licensed guide",
    tierLicensedHint: "You hold a guiding licence and run paid tours.",
    tierHost: "Local host",
    tierHostHint: "You show people around for free. You cannot charge through Mshwar.",
    nameLabel: "Name travellers will see",
    headlineLabel: "One line about your days",
    headlinePlaceholder: "Tripoli old city, on foot",
    bioLabel: "About you",
    bioPlaceholder: "Where you guide, what you show people, how long you have done it.",
    languagesLabel: "Languages",
    regionsLabel: "Regions",
    specialitiesLabel: "Specialities",
    yearsLabel: "Years guiding",
    phoneLabel: "Phone (kept private)",
    saveDraft: "Save",
    saving: "Saving…",
    savedNote: "Saved. Nothing is public until we review it.",
    documentsTitle: "Documents",
    documentsBody: "Only our reviewers see these. They never appear on your page.",
    documentRequired: "Required",
    documentOptional: "Optional",
    documentAdd: "Add",
    documentReplace: "Replace",
    documentReference: "Reference",
    documentIssuer: "Issued by",
    documentExpires: "Expires",
    documentFile: "File reference",
    documentPending: "Waiting for review",
    documentVerified: "Verified",
    documentRejected: "Rejected",
    documentExpired: "Expired",
    documentMissing: "Still needed: {list}",
    submitAction: "Send for review",
    submitting: "Sending…",
    submitBlocked: "Add every required document first.",
    statusDraft: "Draft",
    statusSubmitted: "With our reviewers",
    statusApproved: "Approved",
    statusRejected: "Not approved",
    statusSuspended: "Paused",
    statusDraftBody: "Finish your profile and documents, then send it to us.",
    statusSubmittedBody: "We are checking your documents. You will hear from us by email.",
    statusApprovedBody: "Your page is live. Travellers can find you.",
    statusRejectedBody: "Edit what we flagged and send it again.",
    statusSuspendedBody: "Your page is hidden. Contact us to sort it out.",
    viewPublicPage: "View your page",
    badgeLicensed: "Licensed guide",
    badgeHost: "Local host",
    badgeLapsed: "Licence expired",
    directoryTitle: "Guides",
    directoryBody: "People who run the day with you. Licensed guides charge; local hosts do not.",
    directoryEmpty: "No guides here yet.",
    directoryFilterRegion: "Region",
    directoryFilterLanguage: "Language",
    directoryAll: "All",
    guideLanguages: "Speaks",
    guideRegions: "Guides in",
    guideSpecialities: "Known for",
    guideYears: "{n} years guiding",
    guideNotFound: "That guide does not have a page.",
    queueTitle: "Guide applications",
    queueBody: "Verify the documents first — approval is blocked until every required one is verified.",
    queueEmpty: "Nothing waiting.",
    queueFilterAll: "All",
    queueMissing: "Missing",
    queueDocuments: "{n} documents",
    queueReview: "Review",
    reviewVerify: "Verify",
    reviewReject: "Reject",
    reviewApprove: "Approve",
    reviewSuspend: "Suspend",
    reviewReason: "Reason",
    reviewReasonPlaceholder: "What the guide needs to fix",
    reviewBlocked: "Verify every required document before approving.",
    reviewBack: "Back to the queue",
    loadError: "We could not load that. Try again.",
    docLicence: "Guiding licence",
    docId: "ID",
    docFirstAid: "First aid",
    docInsurance: "Insurance",
    docDriving: "Driving licence",
  },
  ar: {
    kicker: "أرشد مع مشوار",
    applyTitle: "أرشد مع مشوار",
    applyBody: "انشر الأيام التي ترشدها أصلاً. المسافرون يجدونك ويطلبونك ويدفعون لك في اليوم نفسه.",
    tierLabel: "كيف ترشد؟",
    tierLicensed: "مرشد مرخّص",
    tierLicensedHint: "تحمل رخصة إرشاد وتنظّم جولات مدفوعة.",
    tierHost: "مضيف محلي",
    tierHostHint: "تتجوّل مع الناس مجاناً. لا يمكنك تقاضي المال عبر مشوار.",
    nameLabel: "الاسم الذي يراه المسافرون",
    headlineLabel: "سطر واحد عن أيامك",
    headlinePlaceholder: "مدينة طرابلس القديمة، مشياً",
    bioLabel: "عنك",
    bioPlaceholder: "أين ترشد، وماذا تُري الناس، ومنذ متى.",
    languagesLabel: "اللغات",
    regionsLabel: "المناطق",
    specialitiesLabel: "التخصصات",
    yearsLabel: "سنوات الإرشاد",
    phoneLabel: "الهاتف (يبقى خاصاً)",
    saveDraft: "حفظ",
    saving: "جارٍ الحفظ…",
    savedNote: "تم الحفظ. لا شيء يُنشر قبل المراجعة.",
    documentsTitle: "المستندات",
    documentsBody: "يراها المراجعون فقط ولا تظهر على صفحتك أبداً.",
    documentRequired: "مطلوب",
    documentOptional: "اختياري",
    documentAdd: "إضافة",
    documentReplace: "استبدال",
    documentReference: "الرقم",
    documentIssuer: "جهة الإصدار",
    documentExpires: "تنتهي في",
    documentFile: "مرجع الملف",
    documentPending: "بانتظار المراجعة",
    documentVerified: "تم التحقق",
    documentRejected: "مرفوض",
    documentExpired: "منتهية",
    documentMissing: "ما زال مطلوباً: {list}",
    submitAction: "أرسل للمراجعة",
    submitting: "جارٍ الإرسال…",
    submitBlocked: "أضف كل المستندات المطلوبة أولاً.",
    statusDraft: "مسودة",
    statusSubmitted: "لدى المراجعين",
    statusApproved: "معتمد",
    statusRejected: "غير معتمد",
    statusSuspended: "موقوف",
    statusDraftBody: "أكمل ملفك ومستنداتك ثم أرسلها إلينا.",
    statusSubmittedBody: "نراجع مستنداتك وسنتواصل معك بالبريد.",
    statusApprovedBody: "صفحتك منشورة ويمكن للمسافرين إيجادك.",
    statusRejectedBody: "عدّل ما أشرنا إليه وأعد الإرسال.",
    statusSuspendedBody: "صفحتك مخفية. تواصل معنا لحلّ الأمر.",
    viewPublicPage: "اعرض صفحتك",
    badgeLicensed: "مرشد مرخّص",
    badgeHost: "مضيف محلي",
    badgeLapsed: "الرخصة منتهية",
    directoryTitle: "المرشدون",
    directoryBody: "أشخاص يقضون اليوم معك. المرشدون المرخّصون يتقاضون، والمضيفون لا.",
    directoryEmpty: "لا مرشدين هنا بعد.",
    directoryFilterRegion: "المنطقة",
    directoryFilterLanguage: "اللغة",
    directoryAll: "الكل",
    guideLanguages: "يتحدث",
    guideRegions: "يرشد في",
    guideSpecialities: "معروف بـ",
    guideYears: "{n} سنوات إرشاد",
    guideNotFound: "لا صفحة لهذا المرشد.",
    queueTitle: "طلبات الإرشاد",
    queueBody: "تحقّق من المستندات أولاً — الاعتماد محجوب حتى التحقق من كل مستند مطلوب.",
    queueEmpty: "لا شيء بالانتظار.",
    queueFilterAll: "الكل",
    queueMissing: "ناقص",
    queueDocuments: "{n} مستندات",
    queueReview: "مراجعة",
    reviewVerify: "تحقّق",
    reviewReject: "رفض",
    reviewApprove: "اعتماد",
    reviewSuspend: "إيقاف",
    reviewReason: "السبب",
    reviewReasonPlaceholder: "ما الذي على المرشد إصلاحه",
    reviewBlocked: "تحقّق من كل مستند مطلوب قبل الاعتماد.",
    reviewBack: "العودة إلى القائمة",
    loadError: "تعذّر التحميل. حاول مجدداً.",
    docLicence: "رخصة الإرشاد",
    docId: "الهوية",
    docFirstAid: "إسعافات أولية",
    docInsurance: "تأمين",
    docDriving: "رخصة قيادة",
  },
  fr: {
    kicker: "Guider avec Mshwar",
    applyTitle: "Guider avec Mshwar",
    applyBody:
      "Publiez les journées que vous menez déjà. Les voyageurs vous trouvent, vous demandent et vous paient le jour même.",
    tierLabel: "Comment guidez-vous ?",
    tierLicensed: "Guide licencié",
    tierLicensedHint: "Vous avez une licence et menez des visites payantes.",
    tierHost: "Hôte local",
    tierHostHint: "Vous faites découvrir gratuitement. Vous ne pouvez pas facturer via Mshwar.",
    nameLabel: "Nom vu par les voyageurs",
    headlineLabel: "Une ligne sur vos journées",
    headlinePlaceholder: "Vieille ville de Tripoli, à pied",
    bioLabel: "À propos de vous",
    bioPlaceholder: "Où vous guidez, ce que vous montrez, depuis combien de temps.",
    languagesLabel: "Langues",
    regionsLabel: "Régions",
    specialitiesLabel: "Spécialités",
    yearsLabel: "Années d’expérience",
    phoneLabel: "Téléphone (privé)",
    saveDraft: "Enregistrer",
    saving: "Enregistrement…",
    savedNote: "Enregistré. Rien n’est public avant notre examen.",
    documentsTitle: "Documents",
    documentsBody: "Seuls nos examinateurs les voient. Ils n’apparaissent jamais sur votre page.",
    documentRequired: "Requis",
    documentOptional: "Facultatif",
    documentAdd: "Ajouter",
    documentReplace: "Remplacer",
    documentReference: "Référence",
    documentIssuer: "Délivré par",
    documentExpires: "Expire le",
    documentFile: "Référence du fichier",
    documentPending: "En attente d’examen",
    documentVerified: "Vérifié",
    documentRejected: "Refusé",
    documentExpired: "Expiré",
    documentMissing: "Encore requis : {list}",
    submitAction: "Envoyer pour examen",
    submitting: "Envoi…",
    submitBlocked: "Ajoutez d’abord tous les documents requis.",
    statusDraft: "Brouillon",
    statusSubmitted: "Chez nos examinateurs",
    statusApproved: "Approuvé",
    statusRejected: "Non approuvé",
    statusSuspended: "Suspendu",
    statusDraftBody: "Complétez votre profil et vos documents, puis envoyez-les.",
    statusSubmittedBody: "Nous vérifions vos documents. Vous recevrez un e-mail.",
    statusApprovedBody: "Votre page est en ligne. Les voyageurs peuvent vous trouver.",
    statusRejectedBody: "Corrigez ce que nous avons signalé et renvoyez.",
    statusSuspendedBody: "Votre page est masquée. Contactez-nous.",
    viewPublicPage: "Voir votre page",
    badgeLicensed: "Guide licencié",
    badgeHost: "Hôte local",
    badgeLapsed: "Licence expirée",
    directoryTitle: "Guides",
    directoryBody: "Des personnes qui passent la journée avec vous. Les guides licenciés facturent, les hôtes non.",
    directoryEmpty: "Aucun guide ici pour l’instant.",
    directoryFilterRegion: "Région",
    directoryFilterLanguage: "Langue",
    directoryAll: "Tous",
    guideLanguages: "Parle",
    guideRegions: "Guide à",
    guideSpecialities: "Connu pour",
    guideYears: "{n} ans d’expérience",
    guideNotFound: "Ce guide n’a pas de page.",
    queueTitle: "Candidatures de guides",
    queueBody: "Vérifiez d’abord les documents — l’approbation est bloquée tant qu’ils ne le sont pas tous.",
    queueEmpty: "Rien en attente.",
    queueFilterAll: "Tous",
    queueMissing: "Manquant",
    queueDocuments: "{n} documents",
    queueReview: "Examiner",
    reviewVerify: "Vérifier",
    reviewReject: "Refuser",
    reviewApprove: "Approuver",
    reviewSuspend: "Suspendre",
    reviewReason: "Motif",
    reviewReasonPlaceholder: "Ce que le guide doit corriger",
    reviewBlocked: "Vérifiez chaque document requis avant d’approuver.",
    reviewBack: "Retour à la liste",
    loadError: "Chargement impossible. Réessayez.",
    docLicence: "Licence de guide",
    docId: "Pièce d’identité",
    docFirstAid: "Premiers secours",
    docInsurance: "Assurance",
    docDriving: "Permis de conduire",
  },
};

export type GuideCopy = Record<GuideKey, string>;

export function useGuideCopy(): GuideCopy {
  const { locale } = useLocale();
  return guideCopy[locale];
}
