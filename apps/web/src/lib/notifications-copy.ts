import type { Locale } from "@/lib/locale";
import { useLocale } from "@/components/shell/locale-provider";

export type NotificationCopyKey =
  | "prefsTitle"
  | "prefsBody"
  | "marketingEmail"
  | "marketingInApp"
  | "transactionalAlways"
  | "consentHistory"
  | "granted"
  | "revoked"
  | "savePrefs"
  | "prefsSaved"
  | "unsubTitle"
  | "unsubBody"
  | "unsubAction"
  | "unsubDone"
  | "unsubInvalid"
  | "healthTitle"
  | "outboxDepth"
  | "deadLetters"
  | "pending"
  | "resend"
  | "resendReason"
  | "channelRates"
  | "businessPrefsTitle"
  | "businessPrefsBody"
  | "escalationTitle"
  | "firstMinutes"
  | "repeatMinutes"
  | "maxEscalations"
  | "emailChannel"
  | "inAppChannel"
  | "saveEscalation"
  | "roleLabel";

export const notificationCopy: Record<Locale, Record<NotificationCopyKey, string>> = {
  en: {
    prefsTitle: "Communication preferences",
    prefsBody: "Marketing is optional. Booking and payment emails always send.",
    marketingEmail: "Marketing email",
    marketingInApp: "Marketing in-app",
    transactionalAlways: "Transactional messages cannot be switched off.",
    consentHistory: "Consent history",
    granted: "Granted",
    revoked: "Revoked",
    savePrefs: "Save preferences",
    prefsSaved: "Preferences saved.",
    unsubTitle: "Unsubscribe from marketing",
    unsubBody: "This only stops marketing. Booking updates still arrive.",
    unsubAction: "Unsubscribe",
    unsubDone: "You are unsubscribed from marketing.",
    unsubInvalid: "This unsubscribe link is invalid.",
    healthTitle: "Notification delivery",
    outboxDepth: "Outbox depth",
    deadLetters: "Dead letters",
    pending: "Pending retries",
    resend: "Resend",
    resendReason: "Why are you resending?",
    channelRates: "Per-channel rates",
    businessPrefsTitle: "Staff notification preferences",
    businessPrefsBody: "Choose which roles get email or in-app alerts for new and unanswered requests.",
    escalationTitle: "Unanswered-request escalation",
    firstMinutes: "First reminder (minutes)",
    repeatMinutes: "Repeat every (minutes)",
    maxEscalations: "Maximum reminders",
    emailChannel: "Email",
    inAppChannel: "In-app",
    saveEscalation: "Save schedule",
    roleLabel: "Role",
  },
  ar: {
    prefsTitle: "تفضيلات التواصل",
    prefsBody: "التسويق اختياري. رسائل الحجز والدفع تُرسل دائماً.",
    marketingEmail: "بريد تسويقي",
    marketingInApp: "إشعارات تسويقية داخل التطبيق",
    transactionalAlways: "لا يمكن إيقاف الرسائل المعاملية.",
    consentHistory: "سجل الموافقة",
    granted: "مُنحت",
    revoked: "أُلغيت",
    savePrefs: "حفظ التفضيلات",
    prefsSaved: "تم حفظ التفضيلات.",
    unsubTitle: "إلغاء الاشتراك التسويقي",
    unsubBody: "هذا يوقف التسويق فقط. تحديثات الحجز تصل كما هي.",
    unsubAction: "إلغاء الاشتراك",
    unsubDone: "تم إلغاء اشتراكك التسويقي.",
    unsubInvalid: "رابط إلغاء الاشتراك غير صالح.",
    healthTitle: "تسليم الإشعارات",
    outboxDepth: "عمق صندوق الصادر",
    deadLetters: "الرسائل الميتة",
    pending: "إعادة المحاولة",
    resend: "إعادة إرسال",
    resendReason: "لماذا تعيد الإرسال؟",
    channelRates: "معدلات كل قناة",
    businessPrefsTitle: "تفضيلات إشعارات الفريق",
    businessPrefsBody: "اختر الأدوار التي تتلقى بريداً أو إشعاراً للطلبات الجديدة والتي بلا رد.",
    escalationTitle: "تصعيد الطلبات بلا رد",
    firstMinutes: "أول تذكير (دقائق)",
    repeatMinutes: "التكرار كل (دقائق)",
    maxEscalations: "أقصى عدد تذكيرات",
    emailChannel: "البريد",
    inAppChannel: "داخل التطبيق",
    saveEscalation: "حفظ الجدول",
    roleLabel: "الدور",
  },
  fr: {
    prefsTitle: "Préférences de communication",
    prefsBody: "Le marketing est facultatif. Les e-mails de réservation et de paiement partent toujours.",
    marketingEmail: "E-mail marketing",
    marketingInApp: "Notifications marketing in-app",
    transactionalAlways: "Les messages transactionnels ne peuvent pas être désactivés.",
    consentHistory: "Historique des consentements",
    granted: "Accordé",
    revoked: "Révoqué",
    savePrefs: "Enregistrer",
    prefsSaved: "Préférences enregistrées.",
    unsubTitle: "Se désabonner du marketing",
    unsubBody: "Cela n’arrête que le marketing. Les mises à jour de réservation arrivent encore.",
    unsubAction: "Se désabonner",
    unsubDone: "Vous êtes désabonné du marketing.",
    unsubInvalid: "Ce lien de désabonnement est invalide.",
    healthTitle: "Livraison des notifications",
    outboxDepth: "Profondeur de l’outbox",
    deadLetters: "Lettres mortes",
    pending: "Relances en attente",
    resend: "Renvoyer",
    resendReason: "Pourquoi renvoyer ?",
    channelRates: "Taux par canal",
    businessPrefsTitle: "Préférences d’équipe",
    businessPrefsBody: "Choisissez quels rôles reçoivent e-mail ou in-app pour les demandes nouvelles ou sans réponse.",
    escalationTitle: "Escalade des demandes sans réponse",
    firstMinutes: "Premier rappel (minutes)",
    repeatMinutes: "Répéter toutes les (minutes)",
    maxEscalations: "Rappels maximum",
    emailChannel: "E-mail",
    inAppChannel: "In-app",
    saveEscalation: "Enregistrer le calendrier",
    roleLabel: "Rôle",
  },
};

export function useNotificationCopy() {
  const { locale } = useLocale();
  return notificationCopy[locale];
}
